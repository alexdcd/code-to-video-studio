#!/usr/bin/env python3
"""Split a generated character sheet/grid into deterministic cells."""
from __future__ import annotations
import argparse, json
from pathlib import Path
from PIL import Image


def parse_names(value:str, count:int):
    names=[x.strip() for x in value.split(',') if x.strip()] if value else []
    if names and len(names)!=count: raise SystemExit(f'--names expected {count} names, got {len(names)}')
    return names or [f'cell-{i:02d}' for i in range(count)]


def main():
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('input'); p.add_argument('--rows',type=int,required=True); p.add_argument('--cols',type=int,required=True); p.add_argument('--output-dir',required=True)
    p.add_argument('--names',default=''); p.add_argument('--padding',type=int,default=0); p.add_argument('--json-out',default=''); a=p.parse_args()
    if a.rows<1 or a.cols<1: raise SystemExit('rows/cols must be >= 1')
    src=Path(a.input).expanduser().resolve(); out=Path(a.output_dir).expanduser().resolve(); out.mkdir(parents=True,exist_ok=True)
    with Image.open(src) as opened: im=opened.convert('RGBA')
    cw=im.width/a.cols; ch=im.height/a.rows; names=parse_names(a.names,a.rows*a.cols); cells=[]
    for r in range(a.rows):
        for c in range(a.cols):
            idx=r*a.cols+c; l=round(c*cw)+a.padding; t=round(r*ch)+a.padding; rr=round((c+1)*cw)-a.padding; bb=round((r+1)*ch)-a.padding
            if rr<=l or bb<=t: raise SystemExit('padding collapses a cell')
            crop=im.crop((l,t,rr,bb)); path=out/f'{names[idx]}.png'; crop.save(path); cells.append({'name':names[idx],'path':str(path),'box':[l,t,rr,bb]})
    report={'ok':True,'input':str(src),'rows':a.rows,'cols':a.cols,'cells':cells}
    if a.json_out:
        q=Path(a.json_out).expanduser().resolve(); q.parent.mkdir(parents=True,exist_ok=True); q.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
if __name__=='__main__': main()
