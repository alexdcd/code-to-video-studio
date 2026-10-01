#!/usr/bin/env python3
"""Create a labeled turnaround QA sheet with full-body and subject crops."""
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
from _common import DEFAULT_VIEWS, foreground_mask


def fit_rgba(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.contain(im, size, Image.Resampling.LANCZOS)


def checker(size: tuple[int, int], square: int = 16) -> Image.Image:
    img = Image.new('RGB', size, '#fff')
    d = ImageDraw.Draw(img)
    for y in range(0, size[1], square):
        for x in range(0, size[0], square):
            if (x//square + y//square) % 2:
                d.rectangle((x, y, min(size[0]-1,x+square-1), min(size[1]-1,y+square-1)), fill='#eee')
    return img


def find_view(root: Path, name: str) -> Path | None:
    for ext in ['.png', '.webp', '.jpg', '.jpeg']:
        p = root / f'{name}{ext}'
        if p.is_file():
            return p
    return None


def subject_crop(im: Image.Image) -> Image.Image:
    mask = foreground_mask(im)
    bbox = mask.getbbox()
    if not bbox:
        return im
    l,t,r,b = bbox
    w,h = im.size
    bw, bh = r-l, b-t
    pad_x, pad_y = int(bw*.12), int(bh*.08)
    return im.crop((max(0,l-pad_x), max(0,t-pad_y), min(w,r+pad_x), min(h,b+pad_y)))


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--views-dir', required=True)
    p.add_argument('--output', required=True)
    p.add_argument('--views', default=','.join(DEFAULT_VIEWS))
    p.add_argument('--cell-width', type=int, default=300)
    p.add_argument('--cell-height', type=int, default=340)
    args = p.parse_args()
    root = Path(args.views_dir).expanduser().resolve()
    names = [x.strip() for x in args.views.split(',') if x.strip()]
    files = [(name, find_view(root, name)) for name in names]
    missing = [name for name, path in files if path is None]
    if missing:
        raise SystemExit('missing view image(s): ' + ', '.join(missing))

    cw, ch = args.cell_width, args.cell_height
    label_h = 30
    sheet = Image.new('RGB', (cw*len(names), (ch+label_h)*2), '#f8f8f8')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for i, (name, path) in enumerate(files):
        assert path is not None
        with Image.open(path) as opened:
            im = opened.convert('RGBA')
        for row, source in enumerate([im, subject_crop(im)]):
            x = i*cw; y = row*(ch+label_h)
            draw.rectangle((x,y,x+cw-1,y+label_h-1), fill='#111')
            label = name if row == 0 else f'{name} · crop'
            draw.text((x+8,y+9), label, fill='white', font=font)
            bg = checker((cw,ch))
            fitted = fit_rgba(source, (cw-16,ch-16))
            ox, oy = (cw-fitted.width)//2, (ch-fitted.height)//2
            bg.paste(fitted,(ox,oy),fitted)
            sheet.paste(bg,(x,y+label_h))
            draw.rectangle((x,y+label_h,x+cw-1,y+label_h+ch-1), outline='#c7c7c7')
    out = Path(args.output).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    print(out)

if __name__ == '__main__':
    main()
