#!/usr/bin/env python3
"""Remove a flat chroma background and produce real alpha transparency."""
from __future__ import annotations
import argparse, json, re
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter


def parse_hex(value: str):
    if not re.fullmatch(r'#[0-9A-Fa-f]{6}', value):
        raise SystemExit('--chroma-key must be #RRGGBB')
    return tuple(int(value[i:i+2], 16) for i in (1,3,5))


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('input'); p.add_argument('--output',required=True); p.add_argument('--chroma-key',required=True)
    p.add_argument('--tolerance',type=int,default=32); p.add_argument('--feather',type=int,default=12); p.add_argument('--json-out',default='')
    args=p.parse_args()
    src=Path(args.input).expanduser().resolve(); out=Path(args.output).expanduser().resolve(); key=parse_hex(args.chroma_key)
    with Image.open(src) as opened: rgba=opened.convert('RGBA')
    rgb=rgba.convert('RGB'); solid=Image.new('RGB',rgb.size,key); diff=ImageChops.difference(rgb,solid)
    r,g,b=diff.split(); peak=ImageChops.lighter(ImageChops.lighter(r,g),b)
    lo=max(0,args.tolerance); hi=max(lo+1,lo+max(1,args.feather))
    alpha=peak.point(lambda v: 0 if v<=lo else 255 if v>=hi else round((v-lo)*255/(hi-lo)))
    # Preserve pre-existing transparency if any.
    alpha=ImageChops.multiply(alpha,rgba.getchannel('A'))
    result=rgba.copy(); result.putalpha(alpha)
    data=bytearray(result.tobytes())
    cleared=0
    for i in range(0,len(data),4):
        if data[i+3]==0:
            if data[i] or data[i+1] or data[i+2]: cleared+=1
            data[i]=data[i+1]=data[i+2]=0
    result=Image.frombytes('RGBA',result.size,bytes(data))
    out.parent.mkdir(parents=True,exist_ok=True); result.save(out)
    hist=alpha.histogram(); transparent=hist[0]; opaque=hist[255]; partial=sum(hist[1:255]); total=rgba.width*rgba.height
    report={'ok':True,'input':str(src),'output':str(out),'chromaKey':args.chroma_key.upper(),'tolerance':lo,'feather':args.feather,
            'transparentRatio':transparent/total,'opaqueRatio':opaque/total,'partialRatio':partial/total,'clearedTransparentRgbPixels':cleared}
    if args.json_out:
        q=Path(args.json_out).expanduser().resolve(); q.parent.mkdir(parents=True,exist_ok=True); q.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
if __name__=='__main__': main()
