#!/usr/bin/env python3
"""Shared FFmpeg measurements for render QA and reference analysis."""
from __future__ import annotations

import json
import re
import subprocess
from fractions import Fraction
from pathlib import Path
from statistics import mean, median

SAMPLE_FPS = 10


def run_ffmpeg(args: list[str], timeout: int = 300) -> str:
    result = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", *args],
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    return result.stderr


def probe_video(path: str | Path) -> dict:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)],
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(result.stdout)
    streams = data.get("streams", [])
    video = next((stream for stream in streams if stream.get("codec_type") == "video"), {})
    audio = next((stream for stream in streams if stream.get("codec_type") == "audio"), None)
    rate = video.get("avg_frame_rate") or video.get("r_frame_rate") or "0/1"
    try:
        fps = float(Fraction(rate))
    except (ValueError, ZeroDivisionError):
        fps = None
    duration = data.get("format", {}).get("duration")
    return {
        "durationSeconds": round(float(duration), 6) if duration else None,
        "width": video.get("width"),
        "height": video.get("height"),
        "frameRate": round(fps, 6) if fps else None,
        "videoCodec": video.get("codec_name"),
        "pixelFormat": video.get("pix_fmt"),
        "audio": None if audio is None else {
            "codec": audio.get("codec_name"),
            "sampleRate": int(audio["sample_rate"]) if audio.get("sample_rate") else None,
            "channels": audio.get("channels"),
            "channelLayout": audio.get("channel_layout"),
        },
    }


def probe_basic(path: str | Path) -> tuple[float, bool, list[str]]:
    def query(entries: str, stream: str | None = None) -> str:
        command = ["ffprobe", "-v", "error"]
        if stream:
            command += ["-select_streams", stream]
        command += ["-show_entries", entries, "-of", "csv=p=0", str(path)]
        return subprocess.run(command, capture_output=True, text=True).stdout.strip()

    duration = float(query("format=duration") or 0)
    has_audio = bool(query("stream=codec_type", "a:0"))
    dimensions = query("stream=width,height,r_frame_rate", "v:0").split(",")
    return duration, has_audio, dimensions


def intervals(times: list[float], step: float, minimum: float) -> list[tuple[float, float]]:
    """Group adjacent sampled times and discard intervals shorter than minimum."""
    groups: list[tuple[float, float]] = []
    start = previous = None
    for current in times:
        if start is None:
            start = previous = current
        elif current - previous <= step * 1.01:
            previous = current
        else:
            groups.append((start, previous))
            start = previous = current
    if start is not None:
        groups.append((start, previous))
    return [(a, b + step) for a, b in groups if b + step - a >= minimum - 1e-9]


def frozen_spans(path: str | Path, threshold: float) -> tuple[list[tuple[float, float]], float]:
    filt = (
        f"fps={SAMPLE_FPS},scale=320:-1,format=gray,tblend=all_mode=difference,"
        "signalstats,metadata=print:key=lavfi.signalstats.YAVG"
    )
    output = run_ffmpeg(["-i", str(path), "-vf", filt, "-an", "-f", "null", "-"])
    values = [float(value) for value in re.findall(r"YAVG=([0-9.]+)", output)]
    step = 1 / SAMPLE_FPS
    times = [index * step for index, value in enumerate(values) if index > 0 and value < threshold]
    return intervals(times, step, 2 * step), len(values) * step


def black_spans(path: str | Path) -> list[tuple[float, float]]:
    output = run_ffmpeg(["-i", str(path), "-vf", "blackdetect=d=0.1:pix_th=0.10", "-an", "-f", "null", "-"])
    return [
        (float(start), float(end))
        for start, end in re.findall(r"black_start:([0-9.]+) black_end:([0-9.]+)", output)
    ]


def audio_measurements(path: str | Path) -> dict:
    output = run_ffmpeg(["-i", str(path), "-af", "ebur128=peak=true", "-vn", "-f", "null", "-"])
    summary = output[output.rfind("Summary:"):]

    def number(pattern: str) -> float | None:
        match = re.search(pattern, summary)
        return float(match.group(1)) if match else None

    samples: list[tuple[float, float, float]] = []
    for time_text, momentary_text, short_text in re.findall(
        r"t:\s*([0-9.]+).*?\bM:\s*(-?[0-9.]+)\s+S:\s*(-?[0-9.]+)", output
    ):
        samples.append((float(time_text), float(momentary_text), float(short_text)))

    per_second: dict[int, list[float]] = {}
    for timestamp, momentary, _short in samples:
        if momentary > -70:
            per_second.setdefault(int(timestamp), []).append(momentary)
    loudness_curve = {
        str(second): round(mean(values), 3)
        for second, values in sorted(per_second.items())
    }

    silences = run_ffmpeg(["-i", str(path), "-af", "silencedetect=noise=-50dB:d=0.5", "-vn", "-f", "null", "-"])
    silence_spans = [
        {"startSeconds": float(start), "endSeconds": float(end)}
        for start, end in re.findall(r"silence_start: ([0-9.]+).*?silence_end: ([0-9.]+)", silences, re.S)
    ]

    onsets: list[float] = []
    previous = None
    for timestamp, momentary, _short in samples:
        if previous is not None and momentary > -45 and momentary - previous >= 4.0:
            if not onsets or timestamp - onsets[-1] >= 0.25:
                onsets.append(round(timestamp, 3))
        previous = momentary

    return {
        "integratedLufs": number(r"I:\s+(-?[0-9.]+) LUFS"),
        "loudnessRangeLu": number(r"LRA:\s+([0-9.]+) LU"),
        "truePeakDbfs": number(r"Peak:\s+(-?[0-9.]+) dBFS"),
        "loudnessBySecond": loudness_curve,
        "silences": silence_spans,
        "energyOnsetsSeconds": onsets,
        "onsetMethod": "ebur128 momentary rise of at least 4 LU, separated by 250 ms",
    }


def qa_audio_legacy(path: str | Path) -> dict:
    """Return the legacy QA shape while keeping its existing Spanish CLI output."""
    output = run_ffmpeg(["-i", str(path), "-af", "ebur128=peak=true", "-vn", "-f", "null", "-"])
    summary = output[output.rfind("Summary:"):]

    def number(pattern: str) -> float | None:
        match = re.search(pattern, summary)
        return float(match.group(1)) if match else None

    short_term: dict[int, float] = {}
    for timestamp, short in re.findall(r"t:\s*([0-9.]+)\s.*?S:\s*(-?[0-9.]+)", output):
        second = int(float(timestamp))
        if float(short) > -70:
            short_term[second] = float(short)
    silences = run_ffmpeg(["-i", str(path), "-af", "silencedetect=noise=-50dB:d=0.5", "-vn", "-f", "null", "-"])
    silence_spans = [
        (float(start), float(end))
        for start, end in re.findall(r"silence_start: ([0-9.]+).*?silence_end: ([0-9.]+)", silences, re.S)
    ]
    return {
        "I": number(r"I:\s+(-?[0-9.]+) LUFS"),
        "LRA": number(r"LRA:\s+([0-9.]+) LU"),
        "TP": number(r"Peak:\s+(-?[0-9.]+) dBFS"),
        "cortos": short_term,
        "silencios": silence_spans,
    }


def cut_events(path: str | Path, threshold: float) -> list[float]:
    """Read FFmpeg's deterministic scene score and return candidate cut times."""
    filt = f"select='gt(scene,{threshold})',showinfo"
    output = run_ffmpeg(["-i", str(path), "-vf", filt, "-an", "-f", "null", "-"])
    times = [float(value) for value in re.findall(r"pts_time:([0-9]+(?:\.[0-9]+)?)", output)]
    return sorted({timestamp for timestamp in times if timestamp > 1e-6})


def merge_cut_bursts(times: list[float], burst_seconds: float = 0.5) -> list[float]:
    """Collapse rapid detector bursts to their first reported boundary."""
    merged: list[float] = []
    for timestamp in times:
        if not merged or timestamp - merged[-1] >= burst_seconds:
            merged.append(timestamp)
    return merged


def motion_samples(path: str | Path) -> list[tuple[float, float]]:
    filt = (
        f"fps={SAMPLE_FPS},scale=320:-1,format=gray,tblend=all_mode=difference,"
        "signalstats,metadata=print:key=lavfi.signalstats.YAVG"
    )
    output = run_ffmpeg(["-i", str(path), "-vf", filt, "-an", "-f", "null", "-"])
    frame_times: list[float] = []
    samples: list[tuple[float, float]] = []
    for line in output.splitlines():
        if line.startswith("[Parsed_metadata_") and "pts_time:" in line:
            match = re.search(r"pts_time:([0-9]+(?:\.[0-9]+)?)", line)
            if match:
                frame_times.append(float(match.group(1)))
        value_match = re.search(r"lavfi.signalstats.YAVG=([0-9.]+)", line)
        if value_match and frame_times:
            samples.append((frame_times[-1], float(value_match.group(1))))
    return samples


def average_motion(samples: list[tuple[float, float]], start: float, end: float) -> float | None:
    values = [value for timestamp, value in samples if start <= timestamp < end]
    return round(mean(values), 4) if values else None


def cut_profile(
    duration: float,
    events: list[float],
    motion: list[tuple[float, float]],
) -> dict:
    boundaries = [0.0, *events, duration]
    shots = []
    for start, end in zip(boundaries, boundaries[1:]):
        if end <= start:
            continue
        shots.append({
            "startSeconds": round(start, 3),
            "endSeconds": round(end, 3),
            "durationSeconds": round(end - start, 3),
            "motionEnergy": average_motion(motion, start, end),
        })

    quarter_length = duration / 4 if duration else 0
    quarter_counts = []
    for quarter in range(4):
        start = quarter * quarter_length
        end = duration if quarter == 3 else (quarter + 1) * quarter_length
        count = sum(1 for event in events if start <= event < end)
        per_minute = count * 60 / (end - start) if end > start else 0
        quarter_counts.append(round(per_minute, 3))
    motion_quarters = [
        average_motion(motion, quarter * quarter_length, duration if quarter == 3 else (quarter + 1) * quarter_length)
        for quarter in range(4)
    ]
    shot_lengths = [shot["durationSeconds"] for shot in shots]
    return {
        "cutCount": len(events),
        "cutsPerMinute": round(len(events) * 60 / duration, 3) if duration else 0,
        "cutsPerMinuteByQuarter": quarter_counts,
        "meanShotSeconds": round(mean(shot_lengths), 3) if shot_lengths else None,
        "medianShotSeconds": round(median(shot_lengths), 3) if shot_lengths else None,
        "motionEnergyByQuarter": motion_quarters,
        "shots": shots,
    }


def analyze_video(path: str | Path, thresholds: tuple[float, ...] = (0.30, 0.15, 0.08)) -> dict:
    probe = probe_video(path)
    duration = float(probe.get("durationSeconds") or 0)
    motion = motion_samples(path)
    cuts = {}
    cut_events_by_threshold = {}
    for threshold in thresholds:
        events = merge_cut_bursts(cut_events(path, threshold))
        cut_events_by_threshold[f"{threshold:.2f}"] = events
        cuts[f"{threshold:.2f}"] = cut_profile(duration, events, motion)

    motion_by_second: dict[int, list[float]] = {}
    for timestamp, value in motion:
        motion_by_second.setdefault(int(timestamp), []).append(value)
    seconds = {
        str(second): round(sum(values) / len(values), 4)
        for second, values in sorted(motion_by_second.items())
    }
    audio = audio_measurements(path) if probe["audio"] is not None else None
    if audio is not None:
        selected_cuts = cut_events_by_threshold.get("0.15", [])
        onsets = audio["energyOnsetsSeconds"]
        near = sum(
            1 for cut in selected_cuts
            if any(abs(cut - onset) <= 0.08 for onset in onsets)
        )
        audio["cutOnsetAlignment"] = {
            "thresholdSeconds": 0.08,
            "matchingCuts": near,
            "totalCuts": len(selected_cuts),
            "share": round(near / len(selected_cuts), 4) if selected_cuts else None,
        }
        audio.pop("onsetMethod", None)
        audio["onsetMethod"] = "ebur128 momentary rise of at least 4 LU, separated by 250 ms"

    return {
        "schemaVersion": 1,
        "probe": probe,
        "cuts": {
            "burstMergeSeconds": 0.5,
            "thresholds": cuts,
            "calibratedDefault": 0.15,
        },
        "motion": {
            "sampleFramesPerSecond": SAMPLE_FPS,
            "energyBySecond": seconds,
        },
        "audio": audio,
        "speech": {"status": "unknown" if probe["audio"] is not None else "not_present"},
    }
