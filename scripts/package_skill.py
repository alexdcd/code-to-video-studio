#!/usr/bin/env python3
"""Create a ZIP containing only a skill's manifest-authorized files."""
from __future__ import annotations
import json
import sys
import zipfile
from pathlib import Path, PurePosixPath


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("usage: package_skill.py SKILL_DIR OUTPUT_ZIP")
    skill_root = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    manifest = json.loads((skill_root / "DISTRIBUTION-MANIFEST.json").read_text(encoding="utf-8"))
    name = manifest["name"]
    files = [item["path"] for item in manifest["files"]] + ["DISTRIBUTION-MANIFEST.json"]
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for rel in sorted(files):
            item = PurePosixPath(rel)
            if item.is_absolute() or any(part in {"", ".", ".."} for part in item.parts):
                raise SystemExit(f"unsafe manifest path: {rel}")
            source = skill_root.joinpath(*item.parts)
            if not source.is_file() or source.is_symlink():
                raise SystemExit(f"invalid package file: {rel}")
            archive.write(source, f"{name}/{item.as_posix()}")
    print(json.dumps({"ok": True, "name": name, "files": len(files), "output": str(output)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
