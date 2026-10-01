#!/usr/bin/env python3
"""Render GIF previews from per-action frame directories."""
from __future__ import annotations

import argparse, json
from pathlib import Path
from PIL import Image
from _common import image_files


def main() -> None:
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--frames-root',required=True)
    p.add_argument('--output-dir',required=True)
    p.add_argument('--fps',type=float,default=12.0)
    p.add_argument('--durations-json',default='',help='optional JSON mapping action -> list of ms')
    args=p.parse_args()
    root=Path(args.frames_root).expanduser().resolve(); out=Path(args.output_dir).expanduser().resolve(); out.mkdir(parents=True,exist_ok=True)
    durations={}
    if args.durations_json:
        durations=json.loads(Path(args.durations_json).expanduser().read_text(encoding='utf-8'))
    results=[]
    action_dirs=sorted(p for p in root.iterdir() if p.is_dir())
    if not action_dirs: raise SystemExit(f'no action directories under {root}')
    for d in action_dirs:
        files=image_files(d)
        if not files: continue
        frames=[]
        for path in files:
            with Image.open(path) as opened: frames.append(opened.convert('RGBA'))
        ds=durations.get(d.name)
        if ds is not None and len(ds)!=len(frames): raise SystemExit(f'{d.name}: duration count {len(ds)} != frame count {len(frames)}')
        if ds is None: ds=[round(1000/max(.1,args.fps))]*len(frames)
        output=out/f'{d.name}.gif'
        frames[0].save(output,save_all=True,append_images=frames[1:],duration=ds,loop=0,disposal=2,optimize=False)
        results.append({'action':d.name,'frames':len(frames),'path':str(output)})
    if not results: raise SystemExit('no action frames found')
    print(json.dumps({'ok':True,'previews':results},indent=2))

if __name__=='__main__': main()
