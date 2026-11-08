#!/usr/bin/env python3
"""Measure a local video and create review frames for the Studio workflow."""
from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import video_metrics

ROOT = Path(__file__).resolve().parents[2]
THRESHOLDS = (0.30, 0.15, 0.08)
MAX_CONTACT_SHOTS = 60


def run_checked(args: list[str]) -> None:
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        message = result.stderr.strip() or f"Command failed: {args[0]}"
        raise RuntimeError(message[-4000:])


def extract_frame(source: Path, timestamp: float, output: Path) -> None:
    label = f"{timestamp:.3f}s"
    escaped = label.replace("'", "\\'")
    run_checked([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", f"{timestamp:.6f}", "-i", str(source),
        "-frames:v", "1", "-vf",
        "scale=640:-2:flags=lanczos,drawtext=text='" + escaped + "':x=12:y=12:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=5",
        "-q:v", "3", str(output),
    ])


def write_contact_sheet(frames: list[Path], output: Path) -> None:
    if not frames:
        return
    columns = 6
    rows = math.ceil(len(frames) / columns)
    with tempfile.TemporaryDirectory(prefix="production-analysis-") as temp_name:
        temp_dir = Path(temp_name)
        for index, frame in enumerate(frames, start=1):
            shutil.copyfile(frame, temp_dir / f"contact-{index:03d}.jpg")
        run_checked([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-framerate", "1", "-i", str(temp_dir / "contact-%03d.jpg"),
            "-vf", f"tile={columns}x{rows}:padding=6:margin=6:color=0x111111",
            "-frames:v", "1", "-q:v", "3", str(output),
        ])


def write_three_frame_strip(frames: list[Path], output: Path) -> None:
    if not frames:
        return
    inputs: list[str] = []
    filters: list[str] = []
    labels = []
    for index, path in enumerate(frames):
        inputs.extend(["-i", str(path)])
        filters.append(f"[{index}:v]scale=640:-2:flags=lanczos[v{index}]")
        labels.append(f"[v{index}]")
    filters.append("".join(labels) + f"hstack=inputs={len(frames)}[out]")
    run_checked([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *inputs,
        "-filter_complex", ";".join(filters), "-map", "[out]", "-frames:v", "1",
        "-q:v", "3", str(output),
    ])


def sample_shot_indices(count: int) -> list[int]:
    if count <= MAX_CONTACT_SHOTS:
        return list(range(count))
    return sorted({round(index * (count - 1) / (MAX_CONTACT_SHOTS - 1)) for index in range(MAX_CONTACT_SHOTS)})


def build_visual_evidence(source: Path, output_dir: Path, shots: list[dict]) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    strips_dir = output_dir / "strips"
    if strips_dir.exists():
        shutil.rmtree(strips_dir)
    strips_dir.mkdir(parents=True, exist_ok=True)
    contact_frames: list[Path] = []
    indices = sample_shot_indices(len(shots))
    frame_records = []
    with tempfile.TemporaryDirectory(prefix="production-analysis-frames-") as temp_name:
        temp_dir = Path(temp_name)
        for sample_index, shot_index in enumerate(indices, start=1):
            shot = shots[shot_index]
            start = float(shot["startSeconds"])
            end = float(shot["endSeconds"])
            duration = max(0.0, end - start)
            positions = [
                min(end - 0.001, start + max(0.02, duration * fraction))
                for fraction in (0.15, 0.50, 0.85)
            ]
            if duration < 0.05:
                positions = [max(0.0, (start + end) / 2)] * 3
            strip_frames = []
            for frame_index, timestamp in enumerate(positions, start=1):
                frame_path = temp_dir / f"shot-{sample_index:03d}-{frame_index}.jpg"
                extract_frame(source, max(0.0, timestamp), frame_path)
                strip_frames.append(frame_path)
            contact_path = strips_dir / f"shot-{sample_index:03d}-mid.jpg"
            shutil.copyfile(strip_frames[1], contact_path)
            contact_frames.append(contact_path)
            write_three_frame_strip(strip_frames, strips_dir / f"shot-{sample_index:03d}.jpg")
            frame_records.append({
                "shotNumber": shot_index + 1,
                "contactFrame": f"strips/{contact_path.name}",
                "strip": f"strips/shot-{sample_index:03d}.jpg",
                "timesSeconds": [round(value, 3) for value in positions],
            })
        write_contact_sheet(contact_frames, output_dir / "contact-sheet.jpg")
    return {
        "contactSheet": "contact-sheet.jpg",
        "stripsDirectory": "strips/",
        "totalShots": len(shots),
        "sampledShots": len(indices),
        "samplingCapped": len(indices) < len(shots),
        "sampledShotNumbers": [index + 1 for index in indices],
        "frames": frame_records,
    }


def slug_value(value: str) -> bool:
    return bool(value) and all(char.islower() or char.isdigit() or char == "-" for char in value) and value[0].isalnum()


def reference_destination(name: str) -> Path:
    if not slug_value(name):
        raise ValueError("Reference name must use lowercase letters, numbers, and hyphens.")
    return ROOT / "referencias" / name


def target_paths(source: Path, args) -> tuple[Path, Path, Path | None]:
    if args.mode == "reference":
        destination = reference_destination(args.name or "")
        destination.mkdir(parents=True, exist_ok=True)
        target = destination / ("source" + source.suffix.lower())
        if source.resolve() != target.resolve() and not target.exists():
            shutil.copy2(source, target)
        return target, destination / "analysis.json", destination
    if args.mode == "source":
        if not args.project:
            raise ValueError("Source mode requires --project.")
        resolved = subprocess.run(
            ["node", str(ROOT / "scripts" / "lib" / "project-paths.mjs"), "project", args.project],
            capture_output=True,
            text=True,
            check=False,
        )
        if resolved.returncode:
            raise ValueError(resolved.stderr.strip() or "Could not resolve project path.")
        project = Path(resolved.stdout.strip())
        if not project.is_dir():
            raise ValueError(f"Project directory does not exist: {project}")
        assets = project / "assets"
        if not assets.is_dir():
            raise ValueError(f"Project assets directory does not exist: {assets}")
        return source, assets / f"{source.name}.analysis.json", assets / f".{source.stem}.analysis"
    if args.output_dir:
        output_dir = Path(args.output_dir).expanduser().resolve()
        return source, output_dir / "analysis.json", output_dir / "frames"
    return source, source.with_name(source.stem + "-analysis.json"), source.with_name(source.stem + "-analysis")


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", help="path to a local video file")
    parser.add_argument("--mode", required=True, choices=("reference", "source", "render"))
    parser.add_argument("--name", help="reference folder name for reference mode")
    parser.add_argument("--project", help="project name or directory for source mode")
    parser.add_argument("--output-dir", help="optional output directory for render analysis")
    args = parser.parse_args()
    source = Path(args.video).expanduser().resolve()
    if not source.is_file():
        parser.error(f"Video file does not exist: {source}")
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        parser.error("Both ffmpeg and ffprobe are required.")
    if args.output_dir and args.mode != "render":
        parser.error("--output-dir is only supported in render mode.")

    try:
        actual_source, json_path, visual_dir = target_paths(source, args)
        data = video_metrics.analyze_video(actual_source, THRESHOLDS)
        data["source"] = {"fileName": source.name}
        selected = data["cuts"]["thresholds"][f"{data['cuts']['calibratedDefault']:.2f}"]
        if visual_dir is not None:
            data["frames"] = build_visual_evidence(actual_source, visual_dir, selected["shots"])
        else:
            data["frames"] = {"status": "not_generated"}
        write_json(json_path, data)

        if args.mode == "reference":
            source_json = json_path.parent / "source.json"
            if not source_json.exists():
                write_json(source_json, {
                    "schemaVersion": 1,
                    "title": "TODO",
                    "url": "TODO",
                    "author": "TODO",
                    "publicationDate": "TODO",
                })
        print(f"Analysis saved to {json_path}")
        if data["frames"].get("samplingCapped"):
            print(f"Visual evidence sampled {data['frames']['sampledShots']} of {data['frames']['totalShots']} shots (60-shot limit).")
        return 0
    except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as error:
        print(f"Analysis failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
