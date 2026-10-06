from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import TYPE_CHECKING, Iterable

if TYPE_CHECKING:
    from PIL import Image, ImageChops, ImageStat

IMAGE_SUFFIXES = {'.png', '.webp', '.jpg', '.jpeg'}
DEFAULT_VIEWS = ['front', 'q', 'side']
EXTENDED_VIEWS = ['front', 'q', 'side', 'qback', 'back']
VALID_RENDER_MODES = {'generated-art', 'raster-puppet', 'procedural-svg', 'procedural-canvas', 'rigged-svg', 'raster-sprites'}


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r'[^a-z0-9]+', '-', value).strip('-')
    return value or 'character'


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def image_files(root: Path, recursive: bool = False) -> list[Path]:
    iterator = root.rglob('*') if recursive else root.iterdir()
    # Files starting with "_" are QA/tooling outputs (e.g. _components-qa.png), never production frames or parts.
    return sorted(p for p in iterator if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES and not p.name.startswith('_'))


def open_rgba(path: Path) -> Image.Image:
    from PIL import Image
    with Image.open(path) as im:
        return im.convert('RGBA')


def _opaque_background_mask(rgba: Image.Image, threshold: int) -> Image.Image:
    from PIL import Image, ImageChops
    w, h = rgba.size
    px = rgba.load()
    corners = [px[0, 0][:3], px[w - 1, 0][:3], px[0, h - 1][:3], px[w - 1, h - 1][:3]]
    bg = tuple(round(sum(c[i] for c in corners) / 4) for i in range(3))
    rgb = rgba.convert('RGB')
    solid = Image.new('RGB', rgba.size, bg)
    diff = ImageChops.difference(rgb, solid)
    r, g, b = diff.split()
    peak = ImageChops.lighter(ImageChops.lighter(r, g), b)
    return peak.point(lambda v: 255 if v > threshold else 0)


def foreground_mask(image: Image.Image, threshold: int = 18) -> Image.Image:
    """Return an L mask for likely subject pixels without Python per-pixel loops."""
    rgba = image.convert('RGBA')
    alpha = rgba.getchannel('A')
    amin, _ = alpha.getextrema()
    if amin < 250:
        return alpha.point(lambda a: 255 if a > 16 else 0)
    return _opaque_background_mask(rgba, threshold)


def bbox_and_stats(image: Image.Image) -> dict:
    from PIL import Image, ImageChops
    mask = foreground_mask(image)
    bbox = mask.getbbox()
    w, h = image.size
    if not bbox:
        return {'bbox': None, 'areaPixels': 0, 'areaRatio': 0.0, 'center': None, 'edgePixels': 0}
    l, t, r, b = bbox
    hist = mask.histogram()
    area = sum(hist[1:]) / 255
    margin = max(1, round(min(w, h) * 0.01))
    edge = Image.new('L', (w, h), 0)
    # Four border bands; C-backed drawing is not needed for these tiny masks.
    from PIL import ImageDraw
    d = ImageDraw.Draw(edge)
    d.rectangle((0, 0, w - 1, margin - 1), fill=255)
    d.rectangle((0, h - margin, w - 1, h - 1), fill=255)
    d.rectangle((0, 0, margin - 1, h - 1), fill=255)
    d.rectangle((w - margin, 0, w - 1, h - 1), fill=255)
    edge_pixels = sum(ImageChops.multiply(mask, edge).histogram()[1:]) / 255
    return {
        'bbox': [l, t, r, b],
        'areaPixels': int(area),
        'areaRatio': area / max(1, w * h),
        'center': [(l + r) / 2, (t + b) / 2],
        'edgePixels': int(edge_pixels),
    }


def pixel_difference(a: Image.Image, b: Image.Image) -> dict:
    from PIL import Image, ImageChops, ImageStat
    if a.size != b.size:
        return {'sameSize': False, 'differentPixels': None, 'maxChannelDelta': None, 'meanDelta': None}
    diff = ImageChops.difference(a.convert('RGBA'), b.convert('RGBA'))
    extrema = diff.getextrema()
    max_delta = max(mx for _, mx in extrema)
    stat = ImageStat.Stat(diff)
    mean = sum(stat.mean) / len(stat.mean)
    gray = diff.convert('L').point(lambda v: 255 if v else 0)
    changed = gray.histogram()[255]
    return {'sameSize': True, 'differentPixels': changed, 'maxChannelDelta': max_delta, 'meanDelta': mean}


def ensure_within(root: Path, child: Path) -> bool:
    try:
        child.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def iter_files(root: Path) -> Iterable[Path]:
    for path in sorted(root.rglob('*')):
        if path.is_file():
            yield path
