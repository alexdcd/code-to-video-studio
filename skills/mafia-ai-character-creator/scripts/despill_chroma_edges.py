#!/usr/bin/env python3
"""Fast chroma-edge despill for transparent character art.

Optimized for conventional green/blue/red keys using Pillow channel operations
(C-backed), with a generic low-saturation fallback. Alpha is preserved exactly.
"""
from __future__ import annotations
import argparse, json, re
from pathlib import Path
from PIL import Image, ImageChops, ImageEnhance, ImageFilter


def parse_hex(value:str):
    if not re.fullmatch(r'#[0-9A-Fa-f]{6}',value): raise SystemExit('expected --chroma-key #RRGGBB')
    return tuple(int(value[i:i+2],16) for i in (1,3,5))


def main():
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('input'); p.add_argument('--output',required=True); p.add_argument('--chroma-key',required=True)
    p.add_argument('--strength',type=float,default=1); p.add_argument('--edge-radius',type=int,default=5); p.add_argument('--spill-margin',type=int,default=18); p.add_argument('--json-out',default=''); a=p.parse_args()
    src=Path(a.input).expanduser().resolve();out=Path(a.output).expanduser().resolve();key=parse_hex(a.chroma_key);strength=max(0,min(1,a.strength))
    with Image.open(src) as opened: rgba=opened.convert('RGBA')
    alpha=rgba.getchannel('A'); visible=alpha.point(lambda v:255 if v>0 else 0); transparent=ImageChops.invert(visible)
    expanded=transparent.filter(ImageFilter.MaxFilter(max(3,a.edge_radius*2+1))); edge=ImageChops.multiply(visible,expanded)
    r,g,b,aa=rgba.split(); channels=[r,g,b]; dom=max(range(3),key=lambda i:key[i]); sorted_key=sorted(key,reverse=True)
    if sorted_key[0]-sorted_key[1] >= 40:
        others=[channels[i] for i in range(3) if i!=dom]; cap=ImageChops.lighter(others[0],others[1]).point(lambda v:min(255,v+a.spill_margin))
        corrected=channels.copy(); corrected[dom]=ImageChops.darker(channels[dom],cap); clean=Image.merge('RGBA',(*corrected,aa))
    else:
        clean=ImageEnhance.Color(rgba).enhance(max(0,1-strength))
    if strength<1 and sorted_key[0]-sorted_key[1]>=40: clean=Image.blend(rgba,clean,strength)
    result=Image.composite(clean,rgba,edge); result.putalpha(alpha)
    # Transparent RGB is zeroed for clean atlases.
    zero=Image.new('RGBA',rgba.size,(0,0,0,0)); result=Image.composite(result,zero,visible)
    diff=ImageChops.difference(rgba,result).convert('L'); hist=diff.point(lambda v:255 if v else 0).histogram(); changed=hist[255]
    out.parent.mkdir(parents=True,exist_ok=True);result.save(out)
    report={'ok':True,'algorithm':'fast-channel-cap-edge-despill','input':str(src),'output':str(out),'changedPixels':changed,'chromaKey':a.chroma_key.upper(),'alphaPreserved':True,'dominantChannel':['r','g','b'][dom]}
    if a.json_out:
        q=Path(a.json_out).expanduser().resolve();q.parent.mkdir(parents=True,exist_ok=True);q.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
if __name__=='__main__': main()
