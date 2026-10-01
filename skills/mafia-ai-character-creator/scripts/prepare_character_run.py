#!/usr/bin/env python3
"""Prepare a reproducible Mafia AI Character Creator run directory."""
from __future__ import annotations
import argparse, shutil
from pathlib import Path
from _common import DEFAULT_VIEWS, VALID_RENDER_MODES, read_json, slugify, write_json

DEFAULT_ACTIONS=['idle','think','point','walk']
DEFAULT_EXPRESSIONS=['neutral','thinking','surprised','happy']

def split_values(values):
    out=[]
    for value in values: out.extend(x.strip() for x in value.split(',') if x.strip())
    return list(dict.fromkeys(out))

def infer_mode(notes:str, refs:list[Path], profile:dict)->str:
    text=notes.lower()
    if any(k in text for k in ['procedural','code-drawn','code drawn','p5','canvas','watercolor','watercolour','boil']): return 'procedural-canvas'
    if any(k in text for k in ['raster puppet','puppet raster','cutout','cut-out','separate body parts']): return 'raster-puppet'
    if any(k in text for k in ['rigged svg','existing svg rig']): return 'rigged-svg'
    # Public/community default: generated art, then deterministic sprite runtime.
    preferred=profile.get('preferredRenderModes') or []
    return preferred[0] if preferred else 'generated-art'

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--name',default=''); p.add_argument('--description',default=''); p.add_argument('--notes',default=''); p.add_argument('--reference',action='append',default=[])
    p.add_argument('--profile',default=''); p.add_argument('--render-mode',default='auto',choices=['auto',*sorted(VALID_RENDER_MODES)]); p.add_argument('--target',default='')
    p.add_argument('--view',action='append',default=[]); p.add_argument('--action',action='append',default=[]); p.add_argument('--layer',action='append',default=[],help='Add every action of a profile action layer (see references/motion-catalog.md), e.g. presence,communication'); p.add_argument('--expression',action='append',default=[]); p.add_argument('--prop',action='append',default=[])
    p.add_argument('--output-dir',required=True); p.add_argument('--force',action='store_true'); a=p.parse_args()
    refs=[Path(x).expanduser().resolve() for x in a.reference]; missing=[str(x) for x in refs if not x.is_file()]
    if missing: raise SystemExit('missing reference(s): '+', '.join(missing))
    profile={}
    if a.profile:
        pp=Path(a.profile).expanduser().resolve()
        if not pp.is_file(): raise SystemExit(f'profile not found: {pp}')
        profile=read_json(pp)
    name=a.name.strip() or (refs[0].stem.replace('-',' ').replace('_',' ').title() if refs else 'Character')
    cid=slugify(name); description=a.description.strip() or f'Reusable animated character: {name}.'
    required_views=split_values(a.view) or profile.get('requiredViews') or DEFAULT_VIEWS
    optional_views=profile.get('optionalViews') or []
    views=list(dict.fromkeys([*required_views,*optional_views]))
    layers=split_values(a.layer); layer_map=profile.get('actionLayers') or {}
    unknown=[x for x in layers if x not in layer_map]
    if unknown: raise SystemExit(f'unknown action layer(s): {", ".join(unknown)}. Available: {", ".join(layer_map) or "none (profile defines no actionLayers)"}')
    layer_actions=[act for x in layers for act in layer_map[x]]
    explicit=split_values(a.action)
    actions=list(dict.fromkeys([*layer_actions,*explicit])) or profile.get('defaultActions') or DEFAULT_ACTIONS
    expressions=split_values(a.expression) or profile.get('defaultExpressions') or DEFAULT_EXPRESSIONS
    props=split_values(a.prop); mode=a.render_mode if a.render_mode!='auto' else infer_mode(a.notes,refs,profile); target=a.target or profile.get('target') or 'standalone-web'
    root=Path(a.output_dir).expanduser().resolve()
    if root.exists() and any(root.iterdir()) and not a.force: raise SystemExit(f'output directory is not empty: {root} (use --force to reuse it)')
    root.mkdir(parents=True,exist_ok=True)
    for rel in ['inputs/references','brief','generation/prompts','generation/raw','generation/clean','character','qa/frames/views','qa/frames/actions','qa/determinism/forward','qa/determinism/reverse','qa/determinism/fresh','exports']:
        (root/rel).mkdir(parents=True,exist_ok=True)
    copied=[]
    for i,src in enumerate(refs,1):
        dst=root/'inputs/references'/f'{i:02d}-{src.name}'; shutil.copy2(src,dst); copied.append(str(dst.relative_to(root)))
    request={'schemaVersion':2,'id':cid,'displayName':name,'description':description,'notes':a.notes,'renderMode':mode,'target':target,
             'profile':profile.get('id','custom' if profile else 'generic'),'views':views,'requiredViews':required_views,'optionalViews':optional_views,
             'actions':actions,'actionLayers':layers,'expressions':expressions,'props':props,'references':copied,'generatedArt':profile.get('generatedArt',{})}
    write_json(root/'character-request.json',request)
    routeA=[
      {'id':'canonical-design','kind':'visual','dependsOn':[],'output':'generation/raw/canonical-design.png'},
      {'id':'turnaround','kind':'visual','dependsOn':['canonical-design'],'output':'generation/raw/turnaround.png'},
      {'id':'expressions','kind':'visual','dependsOn':['canonical-design'],'output':'generation/raw/expressions.png'},
      {'id':'action-sheets','kind':'visual','dependsOn':['canonical-design'],'output':'generation/raw/actions/'},
      {'id':'matte-cleanup','kind':'deterministic-image','dependsOn':['turnaround','expressions','action-sheets'],'output':'generation/clean/'},
      {'id':'extract-frames','kind':'deterministic-image','dependsOn':['matte-cleanup'],'output':'qa/frames/'},
      {'id':'atlas','kind':'deterministic-image','dependsOn':['extract-frames'],'output':'character/assets/atlas.webp'},
      {'id':'sprite-renderer','kind':'codegen','dependsOn':['atlas'],'output':'character/renderer/character.js'},
      {'id':'qa','kind':'validation','dependsOn':['sprite-renderer'],'output':'character/qa/'}]
    routeB=[
      {'id':'canonical-design','kind':'visual','dependsOn':[],'output':'generation/raw/canonical-design.png'},
      {'id':'turnaround','kind':'visual','dependsOn':['canonical-design'],'output':'generation/raw/turnaround.png'},
      {'id':'renderer','kind':'code','dependsOn':['turnaround'],'output':'character/renderer/'},
      {'id':'acting','kind':'code','dependsOn':['renderer'],'output':'character/renderer/'},
      {'id':'qa-renders','kind':'render','dependsOn':['acting'],'output':'qa/frames/'},
      {'id':'qa','kind':'validation','dependsOn':['qa-renders'],'output':'character/qa/'}]
    write_json(root/'generation/jobs.json',{'schemaVersion':2,'route':'generated-art' if mode in {'generated-art','raster-sprites'} else 'raster-puppet' if mode=='raster-puppet' else 'procedural','jobs':routeA if mode in {'generated-art','raster-sprites'} else routeB})
    brief=f'''# Character brief: {name}\n\n## Goal\n{description}\n\n## Notes\n{a.notes or 'No additional notes supplied.'}\n\n## Route\n- render mode: `{mode}`\n- target: `{target}`\n- required views: {', '.join(required_views)}\n- optional views: {', '.join(optional_views) if optional_views else 'none'}\n- actions: {', '.join(actions)}\n- expressions: {', '.join(expressions)}\n\n## Identity lock\nFill before generating action sheets or implementing a renderer:\n- silhouette/proportions:\n- head/face construction:\n- eyes/mouth rules:\n- limbs/hands/feet:\n- palette/material/line style:\n- asymmetry/markings:\n- fixed accessories:\n- allowed acting deformation:\n- forbidden drift:\n'''
    (root/'brief/CHARACTER-BRIEF.md').write_text(brief,encoding='utf-8')
    print(root)
if __name__=='__main__': main()
