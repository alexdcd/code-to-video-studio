#!/usr/bin/env python3
"""Provider-neutral phrase timing and narration remapping helpers for local audio files."""
from __future__ import annotations

import argparse
import difflib
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path


def tokens(value: str) -> list[str]:
    normalized = unicodedata.normalize("NFD", value.lower())
    normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    return re.findall(r"[a-z0-9]+", normalized)


def load_transcript(file: str | Path) -> list[dict]:
    data = json.loads(Path(file).read_text(encoding="utf-8"))
    if isinstance(data, dict):
        data = data.get("words") or data.get("segments") or []
    if not isinstance(data, list):
        raise ValueError("Transcript must be a list of timestamped words or segments.")
    words = []
    for item in data:
        if not isinstance(item, dict) or not isinstance(item.get("text"), str):
            continue
        start = float(item.get("start", item.get("i", 0)))
        end = float(item.get("end", item.get("f", start)))
        if start < 0 or end < start:
            raise ValueError("Transcript timestamps must be non-negative and ordered.")
        words.append({"text": item["text"], "start": start, "end": end})
    if not words:
        raise ValueError("Transcript contains no timestamped text.")
    return words


def flat_tokens(words: list[dict]) -> list[tuple[str, int]]:
    return [(token, index) for index, word in enumerate(words) for token in tokens(word["text"])]


def nearest_silence(time: float, silences: list[float], radius: float = 0.45) -> float | None:
    if not silences:
        return None
    candidate = min(silences, key=lambda value: abs(value - time))
    return candidate if abs(candidate - time) < radius else None


def phrase_word_indices(words: list[dict], phrases: list[list[str]]) -> list[int]:
    flat = flat_tokens(words)
    position = 0
    result = []
    seen = set()
    for phrase in phrases:
        if len(phrase) != 3:
            raise ValueError("Each phrase must be [id, search text, canonical text].")
        identifier, search, _canonical = phrase
        if not identifier or identifier in seen:
            raise ValueError("Phrase IDs must be non-empty and unique.")
        seen.add(identifier)
        alternatives = [part.strip() for part in str(search).split("|") if part.strip()]
        found = None
        for alternative in alternatives:
            needle = tokens(alternative)
            if not needle:
                continue
            for offset in range(position, len(flat) - len(needle) + 1):
                if [token for token, _ in flat[offset:offset + len(needle)]] == needle:
                    found = offset
                    position = offset + len(needle)
                    break
            if found is not None:
                break
        if found is None:
            raise ValueError(f"Could not find phrase {identifier!r} after transcript token {position}.")
        result.append(flat[found][1])
    return result


def align_phrase_lines(
    words: list[dict],
    phrases: list[list[str]],
    silence_ends: list[float] | None = None,
    silence_starts: list[float] | None = None,
    duration: float | None = None,
) -> list[dict]:
    silence_ends = silence_ends or []
    silence_starts = silence_starts or []
    indices = phrase_word_indices(words, phrases)
    final_end = next((value for value in reversed(silence_starts) if value > words[-1]["start"]), None)
    final_end = final_end if final_end is not None else (duration if duration is not None else words[-1]["end"])
    lines = []
    for index, phrase in enumerate(phrases):
        start_index = indices[index]
        next_index = indices[index + 1] if index + 1 < len(indices) else len(words)
        word_start = words[start_index]["start"]
        candidate = nearest_silence(word_start + 0.15, silence_ends)
        start = candidate if candidate is not None else word_start
        if index == 0 and silence_ends and silence_ends[0] < 0.6:
            start = silence_ends[0]
        next_start = words[indices[index + 1]]["start"] if index + 1 < len(indices) else final_end
        _identifier, _search, canonical = phrase
        line_words = words[start_index:next_index]
        if not line_words:
            raise ValueError(f"Phrase {phrase[0]!r} has no aligned transcript words.")
        transcript_items = [
            {"text": item["text"], "start": item["start"], "end": item["end"]}
            for item in line_words
        ]
        # A phrase starts at the nearest measured silence, while retaining the transcript's relative word timing.
        offset = start - word_start
        timed = [
            {"text": item["text"], "start": item["start"] + offset, "end": item["end"] + offset}
            for item in transcript_items
        ]
        canonical_words = str(canonical).split()
        if len(canonical_words) == len(timed):
            subtitles = [
                {"t": text, "i": item["start"], "f": item["end"]}
                for text, item in zip(canonical_words, timed)
            ]
        else:
            span = max(0.0, next_start - start)
            total = sum(len(text) + 1 for text in canonical_words) or 1
            cursor = start
            subtitles = []
            for text in canonical_words:
                word_span = span * (len(text) + 1) / total
                subtitles.append({"t": text, "i": cursor, "f": cursor + word_span * 0.92})
                cursor += word_span
        lines.append({"id": phrase[0], "inicio": round(start, 3), "texto": canonical, "palabras": subtitles})
    for index, line in enumerate(lines):
        next_start = lines[index + 1]["inicio"] if index + 1 < len(lines) else final_end
        candidates = [value for value in silence_starts if line["inicio"] + 0.2 < value <= next_start + 0.02]
        line_end = max(candidates) if candidates else next_start
        line["fin"] = round(max(line["inicio"], line_end), 3)
        for word in line["palabras"]:
            word["i"] = round(min(max(word["i"], line["inicio"]), line["fin"]), 3)
            word["f"] = round(min(max(word["f"], word["i"]), line["fin"]), 3)
    return lines


def strict_anchors(anchors: list[list[float]]) -> list[list[float]]:
    cleaned = []
    for item in anchors:
        if not isinstance(item, (list, tuple)) or len(item) != 2:
            raise ValueError("Each time-map anchor must be [old_seconds, new_seconds].")
        old, new = float(item[0]), float(item[1])
        if old < 0 or new < 0:
            raise ValueError("Time-map anchors must be non-negative.")
        cleaned.append([old, new])
    cleaned.sort()
    for previous, current in zip(cleaned, cleaned[1:]):
        if current[0] <= previous[0] or current[1] <= previous[1]:
            raise ValueError("Time-map anchors must increase strictly in both timelines.")
    return cleaned


def build_time_map(
    old_words: list[dict],
    new_words: list[dict],
    old_silence_ends: list[float] | None = None,
    new_silence_ends: list[float] | None = None,
    manual: list[list[float]] | None = None,
    exclude: list[list[float]] | None = None,
    end: list[float] | None = None,
) -> list[list[float]]:
    old_silence_ends = old_silence_ends or []
    new_silence_ends = new_silence_ends or []
    old = [(token, old_words[index]["start"]) for token, index in flat_tokens(old_words)]
    new = [(token, new_words[index]["start"]) for token, index in flat_tokens(new_words)]
    matcher = difflib.SequenceMatcher(a=[token for token, _ in old], b=[token for token, _ in new], autojunk=False)
    pairs = [[0.0, 0.0]]
    for block in matcher.get_matching_blocks():
        for offset in range(block.size):
            old_index, new_index = block.a + offset, block.b + offset
            if old_index == 0 or (
                old_index > 0
                and old[old_index][1] - old[old_index - 1][1] > 0.25
                and nearest_silence(old[old_index][1], old_silence_ends) is not None
            ):
                old_time = nearest_silence(old[old_index][1], old_silence_ends) or old[old_index][1]
                new_time = nearest_silence(new[new_index][1], new_silence_ends) or new[new_index][1]
                pairs.append([round(old_time, 3), round(new_time, 3)])
    excluded = exclude or []
    pairs = [pair for pair in pairs if not any(float(start) < pair[0] < float(finish) for start, finish in excluded)]
    pairs.extend(manual or [])
    if end is not None:
        pairs.append(end)
    unique = sorted({(float(old_time), float(new_time)) for old_time, new_time in pairs})
    result = []
    for old_time, new_time in unique:
        if not result or (old_time > result[-1][0] + 0.05 and new_time > result[-1][1] + 0.05):
            result.append([round(old_time, 3), round(new_time, 3)])
    return strict_anchors(result)


def detect_silence(audio: str, threshold: str = "-40dB", minimum: float = 0.12) -> tuple[list[float], list[float]]:
    result = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", audio, "-af", f"silencedetect=n={threshold}:d={minimum}", "-f", "null", "-"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip()[-2000:] or "FFmpeg silencedetect failed.")
    log = result.stderr
    starts = [float(value) for value in re.findall(r"silence_start: ([0-9.]+)", log)]
    ends = [float(value) for value in re.findall(r"silence_end: ([0-9.]+)", log)]
    return starts, ends


def audio_duration(audio: str) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audio],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(result.stdout.strip())


def run_phrases(args: argparse.Namespace) -> int:
    words = load_transcript(args.transcript)
    phrases = json.loads(Path(args.phrases).read_text(encoding="utf-8"))
    starts, ends = detect_silence(args.audio, args.threshold, args.minimum_silence)
    duration = audio_duration(args.audio)
    lines = align_phrase_lines(words, phrases, ends, starts, duration)
    payload = {"duracion": round(duration, 3), "lineas": lines}
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text("window.VOZ = " + json.dumps(payload, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(f"Aligned {len(lines)} phrases across {duration:.2f} seconds → {args.output}")
    return 0


def run_map(args: argparse.Namespace) -> int:
    old_words = load_transcript(args.old_transcript)
    new_words = load_transcript(args.new_transcript)
    old_starts, old_ends = detect_silence(args.old_audio)
    _new_starts, new_ends = detect_silence(args.new_audio)
    manual = json.loads(args.manual)
    exclude = json.loads(args.exclude)
    end = [float(value) for value in args.end.split(":")] if args.end else None
    anchors = build_time_map(old_words, new_words, old_ends, new_ends, manual, exclude, end)
    if len(anchors) < 2:
        raise ValueError("At least two increasing anchors are required; provide a manual or end anchor.")
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text("window.MAPA = " + json.dumps(anchors) + ";\n", encoding="utf-8")
    print(f"{len(anchors)} time-map anchors → {args.output}")
    for old_time, new_time in anchors:
        print(f"  {old_time:8.3f} → {new_time:8.3f}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    phrases = sub.add_parser("phrases", help="align canonical phrases to a word-timed transcript")
    phrases.add_argument("--audio", required=True)
    phrases.add_argument("--transcript", required=True)
    phrases.add_argument("--phrases", required=True, help="JSON [[id, search text, canonical text], ...]")
    phrases.add_argument("--output", required=True)
    phrases.add_argument("--threshold", default="-40dB")
    phrases.add_argument("--minimum-silence", type=float, default=0.12)
    mapping = sub.add_parser("map", help="align two narration timelines with transcript and silence anchors")
    mapping.add_argument("--old-audio", required=True)
    mapping.add_argument("--old-transcript", required=True)
    mapping.add_argument("--new-audio", required=True)
    mapping.add_argument("--new-transcript", required=True)
    mapping.add_argument("--output", required=True)
    mapping.add_argument("--manual", default="[]", help="JSON [[old_seconds, new_seconds], ...]")
    mapping.add_argument("--exclude", default="[]", help="JSON [[old_start, old_end], ...]")
    mapping.add_argument("--end", default="", help="optional final anchor old_seconds:new_seconds")
    args = parser.parse_args(argv)
    try:
        return run_phrases(args) if args.command == "phrases" else run_map(args)
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError, json.JSONDecodeError) as error:
        print(f"Voice timing failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
