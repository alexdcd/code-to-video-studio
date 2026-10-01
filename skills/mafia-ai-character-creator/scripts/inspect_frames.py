#!/usr/bin/env python3
"""Inspect rendered character frames for clipping, emptiness, and geometry outliers."""
from __future__ import annotations

import argparse
import statistics
from pathlib import Path
from _common import bbox_and_stats, image_files, open_rgba, write_json


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--frames-dir', required=True)
    p.add_argument('--json-out', required=True)
    p.add_argument('--center-warning', type=float, default=0.08, help='fraction of image diagonal')
    p.add_argument('--area-ratio-warning', type=float, default=1.35)
    args = p.parse_args()

    root = Path(args.frames_dir).expanduser().resolve()
    files = image_files(root, recursive=True)
    if not files:
        raise SystemExit(f'no images found under {root}')
    frames = []
    for path in files:
        image = open_rgba(path)
        stats = bbox_and_stats(image)
        frames.append({'path': str(path.relative_to(root)), 'size': list(image.size), **stats})

    areas = [f['areaPixels'] for f in frames if f['areaPixels']]
    median_area = statistics.median(areas) if areas else 0
    warnings, errors = [], []
    for f in frames:
        if not f['areaPixels']:
            errors.append(f"{f['path']}: empty/no foreground")
            continue
        if f['edgePixels']:
            warnings.append(f"{f['path']}: foreground touches near-edge band ({f['edgePixels']} px)")
        if median_area:
            ratio = max(f['areaPixels'], median_area) / max(1, min(f['areaPixels'], median_area))
            if ratio > args.area_ratio_warning:
                warnings.append(f"{f['path']}: subject area differs from median by {ratio:.2f}x")

    result = {'ok': not errors, 'errors': errors, 'warnings': warnings, 'frames': frames}
    write_json(Path(args.json_out).expanduser().resolve(), result)
    print(__import__('json').dumps(result, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
