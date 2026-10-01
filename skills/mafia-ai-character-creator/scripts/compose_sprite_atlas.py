#!/usr/bin/env python3
"""Compose a scale-stable, foot-anchored atlas from generated-art frames.

Input layouts supported:
  frames/<action>/*.png
  frames/<view>/<action>/*.png
  frames/<view>/<expression>/<action>/*.png

All frames use ONE global scale. Each subject is anchored by foreground bbox
bottom-center (feet/ground) to the same atlas-cell anchor, preventing visible
size/position jumps when source sheet cell sizes differ.
"""
from __future__ import annotations
import argparse, json, math, sys
from pathlib import Path
from PIL import Image
from _common import foreground_mask, image_files, write_json


def parse_csv(values):
    return [x.strip() for v in values for x in str(v).split(',') if x.strip()]


def discover(root: Path, only_actions: list[str], default_view: str, default_expression: str):
    clips=[]
    for directory in sorted(p for p in root.rglob('*') if p.is_dir()):
        files=image_files(directory)
        if not files:
            continue
        rel=directory.relative_to(root)
        # Do not treat a parent as a clip if it only contains subdirectories; image_files is non-recursive.
        parts=rel.parts
        if len(parts)==1:
            view,expression,action=default_view,default_expression,parts[0]
        elif len(parts)==2:
            view,action=parts; expression=default_expression
        else:
            view,expression,action=parts[-3],parts[-2],parts[-1]
        if only_actions and action not in only_actions:
            continue
        clips.append({'view':view,'expression':expression,'action':action,'files':files})
    # Root itself may be a single action only when explicitly requested.
    if not clips and image_files(root) and len(only_actions)==1:
        clips.append({'view':default_view,'expression':default_expression,'action':only_actions[0],'files':image_files(root)})
    seen=set()
    for c in clips:
        key=(c['view'],c['expression'],c['action'])
        if key in seen:
            raise SystemExit(f'duplicate clip for {key}')
        seen.add(key)
    return clips


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--frames-root',required=True); p.add_argument('--output',required=True); p.add_argument('--metadata',required=True)
    p.add_argument('--cell-width',type=int,default=512); p.add_argument('--cell-height',type=int,default=512); p.add_argument('--columns',type=int,default=8)
    p.add_argument('--padding',type=int,default=12); p.add_argument('--alpha-threshold',type=int,default=16)
    p.add_argument('--action',action='append',default=[]); p.add_argument('--once',action='append',default=[])
    p.add_argument('--default-view',default='front'); p.add_argument('--default-expression',default='neutral'); p.add_argument('--fps',type=float,default=12)
    a=p.parse_args()
    if a.cell_width<8 or a.cell_height<8 or a.padding<0 or a.padding*2>=min(a.cell_width,a.cell_height): raise SystemExit('invalid cell size/padding')
    root=Path(a.frames_root).expanduser().resolve(); out=Path(a.output).expanduser().resolve(); meta=Path(a.metadata).expanduser().resolve()
    actions=parse_csv(a.action); once=set(parse_csv(a.once))
    clips=discover(root,actions,a.default_view,a.default_expression)
    if not clips: raise SystemExit('no frame directories found')

    loaded=[]; max_w=max_h=0
    for clip in clips:
        frames=[]
        for source in clip['files']:
            with Image.open(source) as opened: im=opened.convert('RGBA')
            mask=foreground_mask(im,threshold=a.alpha_threshold); bbox=mask.getbbox()
            if not bbox: raise SystemExit(f'empty foreground: {source}')
            l,t,r,b=bbox; bw,bh=r-l,b-t; max_w=max(max_w,bw); max_h=max(max_h,bh)
            frames.append({'source':source,'image':im,'bbox':bbox,'sourceSize':[im.width,im.height]})
        loaded.append((clip,frames))
    inner_w=a.cell_width-2*a.padding; inner_h=a.cell_height-2*a.padding
    scale=min(inner_w/max_w,inner_h/max_h)
    if scale<=0: raise SystemExit('could not compute positive global scale')
    warnings=[]
    if scale>1.0001:
        msg=(f'Atlas upscale {scale:.2f}x: source character art is smaller than the normalized target. '
             f'{a.cell_width}x{a.cell_height} cells do not add detail. Generate fewer poses per sheet, '
             'use a larger source image, or lower the atlas cell size.')
        warnings.append(msg); print(f'WARNING: {msg}',file=sys.stderr)
    total=sum(len(frames) for _,frames in loaded); cols=max(1,a.columns); atlas_rows=math.ceil(total/cols)
    atlas=Image.new('RGBA',(cols*a.cell_width,atlas_rows*a.cell_height),(0,0,0,0))
    anchor_x=a.cell_width/2; anchor_y=a.cell_height-a.padding
    meta_clips={}; action_index={}; idx=0
    for clip,frames in loaded:
        clip_id=f"{clip['view']}|{clip['expression']}|{clip['action']}"; out_frames=[]
        for item in frames:
            im=item['image']; l,t,r,b=item['bbox']; subject=im.crop((l,t,r,b))
            nw=max(1,round(subject.width*scale)); nh=max(1,round(subject.height*scale)); subject=subject.resize((nw,nh),Image.Resampling.LANCZOS)
            col,row=idx%cols,idx//cols; cell_x,cell_y=col*a.cell_width,row*a.cell_height
            x=round(cell_x+anchor_x-nw/2); y=round(cell_y+anchor_y-nh)
            atlas.alpha_composite(subject,(x,y))
            out_frames.append({
                'index':idx,'source':item['source'].name,'cell':[cell_x,cell_y,a.cell_width,a.cell_height],
                'anchor':[anchor_x,anchor_y],'subjectBox':[x-cell_x,y-cell_y,nw,nh],
                'sourceSubjectBox':list(item['bbox']),'sourceSize':item['sourceSize']
            }); idx+=1
        rec={'id':clip_id,'view':clip['view'],'expression':clip['expression'],'action':clip['action'],
             'playback':'once' if clip['action'] in once else 'loop','fps':a.fps,'frames':out_frames}
        meta_clips[clip_id]=rec; action_index.setdefault(clip['action'],[]).append(clip_id)
    out.parent.mkdir(parents=True,exist_ok=True)
    ext=out.suffix.lower()
    if ext=='.webp': atlas.save(out,'WEBP',lossless=True,method=3)
    else: atlas.save(out)
    data={
      'schemaVersion':2,'image':out.name,'atlasSize':[atlas.width,atlas.height],
      'cellWidth':a.cell_width,'cellHeight':a.cell_height,'columns':cols,'frameCount':total,
      'anchor':{'mode':'feet-center','x':anchor_x,'y':anchor_y},
      'normalization':{'mode':'single-global-scale','scale':scale,'maxSourceSubject':[max_w,max_h],'normalizedMaxSubject':[round(max_w*scale),round(max_h*scale)],'padding':a.padding,'upscaled':scale>1.0001},
      'qualityWarnings':warnings,
      'views':sorted({c['view'] for c in clips}),'expressions':sorted({c['expression'] for c in clips}),'actions':action_index,'clips':meta_clips
    }
    write_json(meta,data)
    print(json.dumps({'ok':True,'output':str(out),'metadata':str(meta),'frameCount':total,'clipCount':len(meta_clips),'globalScale':scale,'upscaled':scale>1.0001,'warnings':warnings,'anchor':data['anchor']},indent=2))
if __name__=='__main__': main()
