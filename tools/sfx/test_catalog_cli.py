"""Exercise the public Node entrypoint against a disposable local catalog."""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


@unittest.skipUnless(shutil.which("node") and shutil.which("ffprobe"), "Node and ffprobe required")
class PublicCatalogCLI(unittest.TestCase):
    def test_add_search_check_and_stage_with_attribution(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "studio"
            (root / "scripts").mkdir(parents=True)
            (root / "tools/sfx").mkdir(parents=True)
            shutil.copyfile(ROOT / "scripts/sfx-catalog.mjs", root / "scripts/sfx-catalog.mjs")
            shutil.copyfile(ROOT / "tools/sfx/catalog.py", root / "tools/sfx/catalog.py")
            recording = Path(tmp) / "input.wav"
            with wave.open(str(recording), "wb") as wav:
                wav.setparams((1, 2, 48000, 4800, "NONE", "not compressed"))
                wav.writeframes(b"\0\0" * 4800)
            project = Path(tmp) / "video"
            project.mkdir()
            env = os.environ.copy()
            env.update(HOME=tmp, USERPROFILE=tmp, PATH=str(Path(sys.executable).parent) + os.pathsep + env.get("PATH", ""))

            def run(*args):
                return subprocess.run(["node", str(root / "scripts/sfx-catalog.mjs"), *args],
                                      cwd=Path(tmp), env=env, capture_output=True, text=True, check=True)

            run("add", str(recording), "--id", "click-soft", "--name", "Soft click",
                "--family", "click", "--gesture", "button", "--energy", "low",
                "--license", "cc-by", "--credit", "A. Creator, CC BY 4.0",
                "--source", "https://example.test/click")
            rows = json.loads(run("list", "--gesture", "button", "--json").stdout)
            self.assertEqual([item["id"] for item in rows], ["click-soft"])
            self.assertEqual(rows[0]["sha256"], hashlib.sha256(recording.read_bytes()).hexdigest())
            run("check")
            staged = json.loads(run("stage", "--project", str(project), "click-soft").stdout)
            self.assertEqual(staged["pools"]["click"], ["assets/sfx/click-soft.wav"])
            self.assertEqual((project / "assets/sfx/click-soft.wav").read_bytes(), recording.read_bytes())
            credits = (project / "assets/sfx/CREDITS.md").read_text(encoding="utf-8")
            self.assertIn("A. Creator, CC BY 4.0", credits)
            run("stage", "--project", str(project), "click-soft")
            self.assertEqual((project / "assets/sfx/CREDITS.md").read_text(encoding="utf-8"), credits)
            self.assertTrue((Path(tmp) / ".code-to-video-studio/sfx/catalogo.json").is_file())
            self.assertFalse((root / "recursos").exists())


if __name__ == "__main__":
    unittest.main()
