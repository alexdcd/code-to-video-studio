#!/usr/bin/env python3
"""Create a labeled contact sheet from character render images."""
from __future__ import annotations

import argparse
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
from _common import image_files


def checker(size: tuple[int, int], square: int = 16) -> Image.Image:
    img = Image.new('RGB', size, '#ffffff')
    d = ImageDraw.Draw(img)
    for y in range(0, size[1], square):
        for x in range(0, size[0], square):
            if (x // square + y // square) % 2:
                d.rectangle((x, y, min(size[0]-1, x+square-1), min(size[1]-1, y+square-1)), fill='#ededed')
    return img


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input-dir', required=True)
    p.add_argument('--output', required=True)
    p.add_argument('--recursive', action='store_true')
    p.add_argument('--columns', type=int, default=5)
    p.add_argument('--cell-width', type=int, default=260)
    p.add_argument('--cell-height', type=int, default=220)
    p.add_argument('--label-height', type=int, default=28)
    args = p.parse_args()
    root = Path(args.input_dir).expanduser().resolve()
    files = image_files(root, recursive=args.recursive)
    if not files:
        raise SystemExit(f'no images found under {root}')
    cols = max(1, args.columns)
    rows = math.ceil(len(files) / cols)
    cw, ch, lh = args.cell_width, args.cell_height, args.label_height
    sheet = Image.new('RGB', (cols*cw, rows*(ch+lh)), '#f7f7f7')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for i, path in enumerate(files):
        x = (i % cols) * cw
        y = (i // cols) * (ch + lh)
        draw.rectangle((x, y, x+cw-1, y+lh-1), fill='#111')
        label = str(path.relative_to(root))
        draw.text((x+6, y+8), label[:48], fill='white', font=font)
        with Image.open(path) as opened:
            im = opened.convert('RGBA')
        fitted = ImageOps.contain(im, (cw-12, ch-12), Image.Resampling.LANCZOS)
        bg = checker((cw, ch))
        ox = (cw - fitted.width)//2
        oy = (ch - fitted.height)//2
        bg.paste(fitted, (ox, oy), fitted)
        sheet.paste(bg, (x, y+lh))
        draw.rectangle((x, y+lh, x+cw-1, y+lh+ch-1), outline='#c8c8c8')
    out = Path(args.output).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    print(out)


if __name__ == '__main__':
    main()
