#!/usr/bin/env python3
"""Detect common fake-transparency checkerboards or fully opaque 'transparent-looking' image backgrounds."""
from __future__ import annotations
import argparse, json, math
from collections import Counter
from pathlib import Path
from PIL import Image


def qcolor(rgb, step=16):
    return tuple(int(round(c/step)*step) for c in rgb)


def main():
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('input'); p.add_argument('--json-out',default=''); args=p.parse_args()
    path=Path(args.input).expanduser().resolve()
    with Image.open(path) as opened: im=opened.convert('RGBA')
    alpha=im.getchannel('A'); amin,amax=alpha.getextrema(); opaque=(amin==amax==255)
    w,h=im.size; sample=[]
    # Sample a border band and a coarse grid. Avoid per-pixel full-image work.
    xs=range(0,w,max(1,w//32)); ys=range(0,h,max(1,h//32)); px=im.load()
    for x in xs:
        sample.append(qcolor(px[x,0][:3])); sample.append(qcolor(px[x,h-1][:3]))
    for y in ys:
        sample.append(qcolor(px[0,y][:3])); sample.append(qcolor(px[w-1,y][:3]))
    counts=Counter(sample); common=counts.most_common(4); total=max(1,len(sample))
    two_ratio=sum(c for _,c in common[:2])/total if len(common)>=2 else 0
    if len(common)>=2:
        c1,c2=common[0][0],common[1][0]; dist=math.sqrt(sum((a-b)**2 for a,b in zip(c1,c2)))
    else: dist=0
    # Checkerboards are usually two close neutrals recurring on the border.
    neutrals=all(max(c)-min(c)<=24 for c,_ in common[:2]) if len(common)>=2 else False
    fake=bool(opaque and len(common)>=2 and two_ratio>.72 and 10<=dist<=90 and neutrals)
    result={'ok':not fake,'opaque':opaque,'fakeTransparencyLikely':fake,'borderTopColors':[{'rgb':c,'count':n} for c,n in common],
            'twoColorBorderRatio':two_ratio,'topColorDistance':dist,
            'recommendation':'Regenerate on a single chroma color or remove the checkerboard before matting.' if fake else 'No common fake-transparency checkerboard detected.'}
    if args.json_out:
        out=Path(args.json_out).expanduser().resolve(); out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
    if fake: raise SystemExit(2)
if __name__=='__main__': main()
