#!/usr/bin/env python3
"""Create a draft character package skeleton from a prepared request."""
from __future__ import annotations
import argparse, json
from pathlib import Path
from _common import read_json, write_json

PROC_STUB='''// Draft procedural renderer. Replace before release.\n// TODO: implement deterministic, seek-safe rendering.\nexport const CHARACTER = __CHARACTER__;\nexport function getCharacterCapabilities(){ return CHARACTER; }\nexport function renderCharacter(target,t,state={}){ throw new Error("TODO: implement character renderer"); }\n'''
PUPPET_STUB='''// Raster-puppet route placeholder. Add transparent parts + assets/puppet.json, then run build_raster_puppet_renderer.py.
export function getCharacterCapabilities(){ return {pending:true}; }
export function renderCharacter(){ throw new Error("Raster-puppet renderer not built yet"); }
'''
SPRITE_STUB='''// Generated-art route placeholder. Do not hand-code this file.\n// Run compose_sprite_atlas.py and then build_sprite_renderer.py.\nexport function getCharacterCapabilities(){ return {pending:true}; }\nexport function renderCharacter(){ throw new Error("Generated-art renderer not built yet"); }\n'''

def main():
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('--request',required=True); p.add_argument('--output-dir',required=True); p.add_argument('--force',action='store_true'); a=p.parse_args()
    req=read_json(Path(a.request).expanduser().resolve()); root=Path(a.output_dir).expanduser().resolve()
    if root.exists() and any(root.iterdir()) and not a.force: raise SystemExit(f'output directory is not empty: {root}')
    for rel in ['renderer','assets','assets/parts','references','qa/previews','qa/frames/views','qa/frames/actions','qa/determinism/forward','qa/determinism/reverse','qa/determinism/fresh','tests']: (root/rel).mkdir(parents=True,exist_ok=True)
    manifest={'schemaVersion':2,'id':req['id'],'displayName':req['displayName'],'description':req['description'],'status':'draft','renderMode':req['renderMode'],'target':req.get('target','standalone-web'),
              'entry':'renderer/character.js','moduleSystem':'esm','views':req.get('views',[]),'requiredViews':req.get('requiredViews',req.get('views',[])),'actions':req.get('actions',[]),'expressions':req.get('expressions',[]),'props':req.get('props',[]),
              'api':{'render':'renderCharacter','capabilities':'getCharacterCapabilities'}}
    write_json(root/'character.json',manifest)
    stub=PUPPET_STUB if manifest['renderMode']=='raster-puppet' else SPRITE_STUB if manifest['renderMode'] in {'generated-art','raster-sprites'} else PROC_STUB.replace('__CHARACTER__',json.dumps(manifest,ensure_ascii=False,indent=2))
    (root/'renderer/character.js').write_text(stub,encoding='utf-8')
    (root/'CHARACTER.md').write_text(f"# {manifest['displayName']}\n\n{manifest['description']}\n\n- Render mode: `{manifest['renderMode']}`\n- Required views: {', '.join(manifest['requiredViews'])}\n- Actions: {', '.join(manifest['actions'])}\n\n## Identity lock\nCopy the approved identity rules here.\n",encoding='utf-8')
    print(root)
if __name__=='__main__': main()
