#!/usr/bin/env python3
"""Measure coarse continuity across declared character views using Pillow vectorized operations."""
from __future__ import annotations
import argparse, json, math
from pathlib import Path
from PIL import Image, ImageChops, ImageOps, ImageStat
from _common import DEFAULT_VIEWS, bbox_and_stats, foreground_mask, sha256_file, write_json


def find_view(root:Path,name:str):
    for ext in ['.png','.webp','.jpg','.jpeg']:
        p=root/f'{name}{ext}'
        if p.is_file(): return p
    return None

def norm_subject(im:Image.Image,size=(256,256)):
    mask=foreground_mask(im); bbox=mask.getbbox(); crop=im.crop(bbox) if bbox else im
    return ImageOps.contain(crop.convert('RGBA'),size,Image.Resampling.LANCZOS)

def centered(im):
    canvas=Image.new('RGBA',(256,256),(0,0,0,0)); canvas.paste(im,((256-im.width)//2,(256-im.height)//2),im); return canvas

def pair_metrics(a,b):
    sa,sb=bbox_and_stats(a),bbox_and_stats(b); diag=math.hypot(a.width,a.height)
    cd=None if not(sa['center'] and sb['center']) else math.hypot(sa['center'][0]-sb['center'][0],sa['center'][1]-sb['center'][1])/max(1,diag)
    ar=None if not(sa['areaPixels'] and sb['areaPixels']) else max(sa['areaPixels'],sb['areaPixels'])/min(sa['areaPixels'],sb['areaPixels'])
    diff=ImageChops.difference(centered(norm_subject(a)),centered(norm_subject(b))).convert('L')
    hist=diff.histogram(); nonzero=sum(hist[1:]); mean=ImageStat.Stat(diff).mean[0]
    return {'centerDeltaRatio':cd,'areaRatio':ar,'normalizedDiffRatio':nonzero/(256*256),'meanNormalizedDelta':mean,
            'firstEdgePixels':sa['edgePixels'],'secondEdgePixels':sb['edgePixels']}

def main():
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('--views-dir',required=True); p.add_argument('--json-out',required=True); p.add_argument('--views',default=','.join(DEFAULT_VIEWS)); p.add_argument('--center-warning',type=float,default=.06); p.add_argument('--area-warning',type=float,default=1.35); a=p.parse_args()
    root=Path(a.views_dir).expanduser().resolve(); names=[x.strip() for x in a.views.split(',') if x.strip()]; items=[]
    for name in names:
        path=find_view(root,name)
        if path is None: raise SystemExit(f'missing view: {name}')
        with Image.open(path) as opened: im=opened.convert('RGBA')
        items.append((name,path,im))
    pairs=[]; warnings=[]
    for (an,ap,av),(bn,bp,bv) in zip(items,items[1:]):
        m=pair_metrics(av,bv); pairs.append({'from':an,'to':bn,**m})
        if m['centerDeltaRatio'] is not None and m['centerDeltaRatio']>a.center_warning: warnings.append(f'{an}->{bn}: center shift {m["centerDeltaRatio"]:.3f}')
        if m['areaRatio'] is not None and m['areaRatio']>a.area_warning: warnings.append(f'{an}->{bn}: area ratio {m["areaRatio"]:.2f}')
        if m['firstEdgePixels'] or m['secondEdgePixels']: warnings.append(f'{an}->{bn}: near-edge foreground detected')
    result={'schemaVersion':2,'ok':True,'reviewRequired':bool(warnings),'views':names,'inputHashes':{name:sha256_file(path) for name,path,_ in items},'warnings':warnings,'pairs':pairs}; write_json(Path(a.json_out).expanduser().resolve(),result); print(json.dumps(result,indent=2))
if __name__=='__main__': main()
