#!/usr/bin/env python3
"""Extract a horizontal or vertical motion strip into deterministic frame files."""
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('strip')
    p.add_argument('--frames', type=int, required=True)
    p.add_argument('--output-dir', required=True)
    p.add_argument('--orientation', choices=['horizontal', 'vertical'], default='horizontal')
    p.add_argument('--prefix', default='frame')
    p.add_argument('--trim-transparent', action='store_true')
    args = p.parse_args()
    if args.frames < 1:
        raise SystemExit('--frames must be >= 1')

    source = Path(args.strip).expanduser().resolve()
    out = Path(args.output_dir).expanduser().resolve()
    out.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as opened:
        image = opened.convert('RGBA')

    if args.orientation == 'horizontal':
        if image.width % args.frames:
            raise SystemExit(f'width {image.width} is not divisible by {args.frames}')
        fw, fh = image.width // args.frames, image.height
    else:
        if image.height % args.frames:
            raise SystemExit(f'height {image.height} is not divisible by {args.frames}')
        fw, fh = image.width, image.height // args.frames

    outputs = []
    for i in range(args.frames):
        if args.orientation == 'horizontal':
            crop = image.crop((i * fw, 0, (i + 1) * fw, fh))
        else:
            crop = image.crop((0, i * fh, fw, (i + 1) * fh))
        if args.trim_transparent:
            bbox = crop.getbbox()
            if bbox:
                crop = crop.crop(bbox)
        path = out / f'{args.prefix}-{i:03d}.png'
        crop.save(path)
        outputs.append(str(path))
    print('\n'.join(outputs))


if __name__ == '__main__':
    main()
