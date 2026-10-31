"""Synthetic integration checks for the local production-analysis tools."""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "lib"))
import video_metrics  # noqa: E402


class ProductionIntelligenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
            raise unittest.SkipTest("ffmpeg and ffprobe are required")
        cls.temp = tempfile.TemporaryDirectory(prefix="production-intelligence-test-")
        cls.temp_dir = Path(cls.temp.name)
        cls.video = cls.temp_dir / "three-shots.mp4"
        command = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", "color=c=red:s=320x180:r=25:d=1",
            "-f", "lavfi", "-i", "color=c=blue:s=320x180:r=25:d=1",
            "-f", "lavfi", "-i", "color=c=green:s=320x180:r=25:d=1",
            "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=3",
            "-filter_complex", "[0:v][1:v][2:v]concat=n=3:v=1:a=0[v];[3:a]volume=-14dB[a]",
            "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "ultrafast",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(cls.video),
        ]
        subprocess.run(command, check=True, capture_output=True, text=True)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_scene_cuts_match_synthetic_boundaries_within_one_frame(self):
        events = video_metrics.merge_cut_bursts(video_metrics.cut_events(self.video, 0.15))
        self.assertEqual(len(events), 2)
        for actual, expected in zip(events, (1.0, 2.0)):
            self.assertLessEqual(abs(actual - expected), 1 / 25)

    def test_cut_bursts_are_collapsed_at_half_second(self):
        self.assertEqual(
            video_metrics.merge_cut_bursts([1.0, 1.2, 1.499, 1.5, 2.1]),
            [1.0, 1.5, 2.1],
        )

    def test_loudness_matches_ffmpeg_ebur128_within_half_lu(self):
        measured = video_metrics.audio_measurements(self.video)["integratedLufs"]
        output = video_metrics.run_ffmpeg([
            "-i", str(self.video), "-af", "ebur128=peak=true:framelog=verbose", "-vn", "-f", "null", "-",
        ])
        summary = output[output.rfind("Summary:"):]
        expected = float(re.search(r"I:\s+(-?[0-9.]+) LUFS", summary).group(1))
        self.assertAlmostEqual(measured, expected, delta=0.5)

    def test_qa_json_and_legacy_text_modes(self):
        script = ROOT / "scripts" / "lib" / "qa-video.py"
        json_run = subprocess.run(
            [sys.executable, str(script), str(self.video), "--json"],
            check=False, capture_output=True, text=True,
        )
        self.assertEqual(json_run.returncode, 0, json_run.stderr)
        report = json.loads(json_run.stdout)
        self.assertEqual(report["schemaVersion"], 1)
        self.assertTrue(report["video"]["hasAudio"])

        text_run = subprocess.run(
            [sys.executable, str(script), str(self.video)],
            check=False, capture_output=True, text=True,
        )
        self.assertEqual(text_run.returncode, 0, text_run.stderr)
        self.assertIn("IMAGEN", text_run.stdout)
        self.assertIn("AUDIO", text_run.stdout)
        self.assertIn(f"{self.video} · 3.0 s", text_run.stdout)

    def test_render_analysis_creates_json_and_three_frame_evidence(self):
        script = ROOT / "scripts" / "lib" / "analyze-video.py"
        result = subprocess.run(
            [sys.executable, str(script), str(self.video), "--mode", "render"],
            check=False, capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        analysis_path = self.temp_dir / "three-shots-analysis.json"
        data = json.loads(analysis_path.read_text(encoding="utf-8"))
        self.assertEqual(data["schemaVersion"], 1)
        self.assertEqual(data["cuts"]["thresholds"]["0.15"]["cutCount"], 2)
        self.assertEqual(data["frames"]["sampledShots"], 3)
        self.assertTrue((self.temp_dir / "three-shots-analysis" / "contact-sheet.jpg").is_file())
        self.assertEqual(len(list((self.temp_dir / "three-shots-analysis" / "strips").glob("shot-*.jpg"))), 6)

    def test_render_analysis_can_keep_outputs_in_a_review_folder(self):
        script = ROOT / "scripts" / "lib" / "analyze-video.py"
        output_dir = self.temp_dir / "review-analysis"
        result = subprocess.run(
            [sys.executable, str(script), str(self.video), "--mode", "render", "--output-dir", str(output_dir)],
            check=False, capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((output_dir / "analysis.json").is_file())
        self.assertTrue((output_dir / "frames" / "contact-sheet.jpg").is_file())


if __name__ == "__main__":
    unittest.main()
