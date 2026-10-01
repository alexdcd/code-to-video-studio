#!/usr/bin/env python3
"""Build a first-pass raster-puppet `puppet.json` from cropped transparent parts.

Expected layouts:
  assets/parts/front/head.png
  assets/parts/front/head--happy.png
  assets/parts/front/torso.png
  assets/parts/q/...

or a flat directory with --view front.

The `humanoid` archetype proposes semantic hierarchy, pivots, joint positions and
simple common poses from part names. It is intentionally a *draft*: image-model
art varies, so release workflow must visually inspect and adjust pivots under
motion before marking the character ready.
"""
from __future__ import annotations
import argparse, json, re
from pathlib import Path
from PIL import Image
from _common import IMAGE_SUFFIXES, write_json

SIDE = {'left': -1, 'right': 1}


def parse_size(s: str):
    m=re.fullmatch(r'(\d+)[xX](\d+)',s.strip())
    if not m: raise argparse.ArgumentTypeError('size must be WIDTHxHEIGHT')
    return int(m.group(1)),int(m.group(2))


def split_name(stem: str):
    if '--' in stem:
        base,expr=stem.split('--',1)
        return base,expr
    return stem,None


def image_size(path: Path):
    with Image.open(path) as im:return im.size


def detect_views(parts_dir: Path, forced: list[str]):
    if forced:return [(v,parts_dir / v if (parts_dir/v).is_dir() else parts_dir) for v in forced]
    sub=[p for p in sorted(parts_dir.iterdir()) if p.is_dir() and any(x.suffix.lower() in IMAGE_SUFFIXES and not x.name.startswith('_') for x in p.iterdir() if x.is_file())]
    if sub:return [(p.name,p) for p in sub]
    return [('front',parts_dir)]


def canonical_part(name: str):
    n=name.lower().replace('_','-').replace(' ', '-')
    aliases={'body':'torso','chest':'torso','left-arm':'arm-left','right-arm':'arm-right','left-leg':'leg-left','right-leg':'leg-right','left-hand':'hand-left','right-hand':'hand-right','left-foot':'foot-left','right-foot':'foot-right','upper-left-arm':'upper-arm-left','upper-right-arm':'upper-arm-right','lower-left-arm':'forearm-left','lower-right-arm':'forearm-right','lower-arm-left':'forearm-left','lower-arm-right':'forearm-right','upper-left-leg':'upper-leg-left','upper-right-leg':'upper-leg-right','lower-left-leg':'lower-leg-left','lower-right-leg':'lower-leg-right'}
    return aliases.get(n,n)


def side_of(name):
    return 'left' if name.endswith('-left') else 'right' if name.endswith('-right') else None


FACE_LAYERS=('eyes','eye-','brows','brow-','mouth','nose')


def is_face_layer(name):
    return name in ('eyes','brows','mouth','nose') or name.startswith(FACE_LAYERS)


def parent_for(name,names):
    if name=='torso':return None
    if is_face_layer(name):return 'head' if 'head' in names else ('torso' if 'torso' in names else None)
    if name=='head':return 'torso' if 'torso' in names else None
    side=side_of(name)
    if name.startswith('upper-arm-') or name.startswith('arm-'):return 'torso' if 'torso' in names else None
    if name.startswith('forearm-'):
        cand=f'upper-arm-{side}';return cand if cand in names else ('torso' if 'torso' in names else None)
    if name.startswith('hand-'):
        for cand in [f'forearm-{side}',f'upper-arm-{side}',f'arm-{side}']:
            if cand in names:return cand
        return 'torso' if 'torso' in names else None
    if name.startswith('upper-leg-') or name.startswith('leg-'):return 'torso' if 'torso' in names else None
    if name.startswith('lower-leg-'):
        cand=f'upper-leg-{side}';return cand if cand in names else ('torso' if 'torso' in names else None)
    if name.startswith('foot-'):
        for cand in [f'lower-leg-{side}',f'upper-leg-{side}',f'leg-{side}']:
            if cand in names:return cand
        return 'torso' if 'torso' in names else None
    return 'torso' if 'torso' in names else None


def pivot_ratio(name):
    if name=='head':return (.5,.88)
    if name=='torso':return (.5,.10)
    if name.startswith(('upper-arm-','forearm-','arm-','upper-leg-','lower-leg-','leg-')):return (.5,.10)
    if name.startswith('hand-'):return (.5,.20)
    if name.startswith('foot-'):return (.30,.20)
    return (.5,.5)


def z_for(name):
    if is_face_layer(name):return 35
    s=side_of(name)
    if s=='left':return 6
    if s=='right':return 20
    if name=='torso':return 10
    if name=='head':return 30
    return 15


def leg_chain_height(sizes,side):
    if f'leg-{side}' in sizes:return sizes[f'leg-{side}'][1]*.90
    return sum(sizes[x][1]*.86 for x in [f'upper-leg-{side}',f'lower-leg-{side}'] if x in sizes) + (sizes.get(f'foot-{side}',(0,0))[1]*.35)


def joint_offset(name,sizes):
    torso=sizes.get('torso',(200,260));tw,th=torso;side=side_of(name);sgn=SIDE.get(side,0)
    if is_face_layer(name):
        # Head pivot sits near the chin (see pivot_ratio), so the face centre is ~0.38 head-heights above it. First guess only: correct x/y in puppet.json.
        hh=sizes.get('head',(150,150))[1]
        return (0,-hh*(.62 if name.startswith('brow') else .50 if name.startswith(('eye','nose')) else .16))
    if name=='head':return (0,0)
    if name.startswith(('upper-arm-','arm-')):return (sgn*tw*.45,th*.20)
    if name.startswith('forearm-'):
        par=f'upper-arm-{side}';return (0,sizes.get(par,(0,120))[1]*.82)
    if name.startswith('hand-'):
        par=next((x for x in [f'forearm-{side}',f'upper-arm-{side}',f'arm-{side}'] if x in sizes),None);return (0,sizes.get(par,(0,100))[1]*.82)
    if name.startswith(('upper-leg-','leg-')):return (sgn*tw*.22,th*.82)
    if name.startswith('lower-leg-'):
        par=f'upper-leg-{side}';return (0,sizes.get(par,(0,140))[1]*.86)
    if name.startswith('foot-'):
        par=next((x for x in [f'lower-leg-{side}',f'upper-leg-{side}',f'leg-{side}'] if x in sizes),None);return (0,sizes.get(par,(0,140))[1]*.86)
    return (0,th*.45)


def suggested_poses(names):
    poses={'idle':{}}
    def add(action,updates):
        p={k:v for k,v in updates.items() if k in names}
        if p:poses[action]=p
    add('point',{'upper-arm-right':{'rotation':-65},'forearm-right':{'rotation':18},'arm-right':{'rotation':-55}})
    add('think',{'upper-arm-right':{'rotation':-25},'forearm-right':{'rotation':-70},'arm-right':{'rotation':-55}})
    walk_a={'upper-arm-left':{'rotation':22},'upper-arm-right':{'rotation':-22},'arm-left':{'rotation':22},'arm-right':{'rotation':-22},'upper-leg-left':{'rotation':-18},'upper-leg-right':{'rotation':18},'leg-left':{'rotation':-18},'leg-right':{'rotation':18}}
    walk_b={'upper-arm-left':{'rotation':-22},'upper-arm-right':{'rotation':22},'arm-left':{'rotation':-22},'arm-right':{'rotation':22},'upper-leg-left':{'rotation':18},'upper-leg-right':{'rotation':-18},'leg-left':{'rotation':18},'leg-right':{'rotation':-18}}
    add('walk',walk_a)
    add('walk-a',walk_a)
    add('walk-b',walk_b)
    add('celebrate',{'upper-arm-left':{'rotation':55},'upper-arm-right':{'rotation':-55},'arm-left':{'rotation':55},'arm-right':{'rotation':-55}})
    return poses


def content_bounds(records,sizes):
    by={r['id']:r for r in records}; memo={}
    def joint_abs(name):
        if name in memo:return memo[name]
        r=by[name]; x=float(r['x']); y=float(r['y'])
        if r.get('parent'):
            px,py=joint_abs(r['parent']);x+=px;y+=py
        memo[name]=(x,y);return memo[name]
    boxes=[]
    for r in records:
        x,y=joint_abs(r['id']);w,h=sizes[r['id']];px,py=r['pivot'];boxes.append((x-px,y-py,x-px+w,y-py+h))
    l=min(b[0] for b in boxes);t=min(b[1] for b in boxes);rr=max(b[2] for b in boxes);bb=max(b[3] for b in boxes)
    return [round(l,2),round(t,2),round(rr,2),round(bb,2)]


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--parts-dir',required=True);p.add_argument('--output',required=True);p.add_argument('--view',action='append',default=[]);p.add_argument('--canvas',type=parse_size,default=(1024,1024));p.add_argument('--anchor-margin',type=int,default=64);p.add_argument('--archetype',choices=['humanoid','free'],default='humanoid');p.add_argument('--no-suggested-poses',action='store_true')
    a=p.parse_args();parts_dir=Path(a.parts_dir).expanduser().resolve();out=Path(a.output).expanduser().resolve();views={};warnings=[]
    for view,folder in detect_views(parts_dir,a.view):
        neutral={};expressions={}
        for f in sorted(folder.iterdir()):
            if not f.is_file() or f.suffix.lower() not in IMAGE_SUFFIXES or f.name.startswith('_'):continue
            stem=f.stem
            if folder==parts_dir and stem.startswith(view+'-'):stem=stem[len(view)+1:]
            base,expr=split_name(stem);base=canonical_part(base)
            if expr:expressions.setdefault(base,{})[expr]=f
            else:neutral[base]=f
        if not neutral:raise SystemExit(f'no neutral part images found for view {view}')
        names=set(neutral);sizes={k:image_size(v) for k,v in neutral.items()}
        if a.archetype=='humanoid' and 'torso' not in names: warnings.append(f'{view}: humanoid layout has no torso; roots will be approximate')
        cw,ch=a.canvas;anchor=(cw/2,ch-a.anchor_margin);left_h=leg_chain_height(sizes,'left');right_h=leg_chain_height(sizes,'right');legs=max(left_h,right_h,0);th=sizes.get('torso',(200,260))[1];torso_y=anchor[1]-legs-th*.82
        records=[]
        for name,f in neutral.items():
            w,h=sizes[name];pr=pivot_ratio(name);pivot=[round(w*pr[0],2),round(h*pr[1],2)];parent=parent_for(name,names)
            if parent is None:
                x,y=(anchor[0],torso_y) if name=='torso' else (anchor[0],anchor[1]-h)
            else:x,y=joint_offset(name,sizes)
            rel=f.relative_to(out.parent).as_posix() if f.is_relative_to(out.parent) else f.relative_to(parts_dir.parent).as_posix()
            rec={'id':name,'src':rel,'parent':parent,'x':round(x,2),'y':round(y,2),'pivot':pivot,'z':z_for(name)}
            if name in expressions:
                rec['expressions']={k:(v.relative_to(out.parent).as_posix() if v.is_relative_to(out.parent) else v.relative_to(parts_dir.parent).as_posix()) for k,v in sorted(expressions[name].items())}
            records.append(rec)
        # Parent before child makes manifests easier to inspect, runtime itself also handles arbitrary order.
        rank={'torso':0,'head':1}
        records.sort(key=lambda r:(0 if r['parent'] is None else 1,rank.get(r['id'],5),r['id']))
        poses={'idle':{}} if a.no_suggested_poses or a.archetype=='free' else suggested_poses(names)
        bounds=content_bounds(records,sizes)
        views[view]={'canvas':[cw,ch],'anchor':[round(anchor[0],2),round(anchor[1],2)],'contentBounds':bounds,'contentSize':[round(bounds[2]-bounds[0],2),round(bounds[3]-bounds[1],2)],'parts':records,'poses':poses}
    data={'schemaVersion':2,'defaultView':next(iter(views)),'defaultExpression':'neutral','layoutDraft':{'method':f'{a.archetype}-heuristic','requiresPivotQA':True,'warning':'Generated pivots/positions are a first pass. Visually verify joints under motion before release.'},'views':views}
    write_json(out,data)
    report={'ok':True,'output':str(out),'views':list(views),'partCounts':{v:len(r['parts']) for v,r in views.items()},'warnings':warnings+['Visual pivot QA is required before release.']}
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()
