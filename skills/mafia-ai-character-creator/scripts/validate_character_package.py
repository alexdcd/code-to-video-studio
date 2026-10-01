#!/usr/bin/env python3
"""Validate a character package: runtime contract, portability, assets, QA, and determinism."""
from __future__ import annotations
import argparse, json, re
from pathlib import Path
from _common import VALID_RENDER_MODES, ensure_within, iter_files, read_json, sha256_file, write_json

FORBIDDEN_SOURCE={
 r'\bMath\.random\s*\(':'uncontrolled Math.random()', r'\bDate\.now\s*\(':'Date.now() used for animation state',
 r'\bperformance\.now\s*\(':'performance.now() used in renderer', r'\bsetInterval\s*\(':'setInterval() hidden recurring state'}
SECRET_PATTERNS=[(re.compile(r'(?i)(api[_-]?key|secret|token)\s*[:=]\s*["\'][^"\']{8,}["\']'),'possible embedded secret'),(re.compile(r'\bsk-[A-Za-z0-9_-]{16,}\b'),'possible API key')]
ABS_PATH_PATTERNS=[re.compile(r'/Users/[^\s"\']+'),re.compile(r'/home/[^\s"\']+'),re.compile(r'/tmp/[^\s"\']+'),re.compile(r'[A-Za-z]:\\Users\\[^\s"\']+')]


def find_image(root:Path,name:str):
    for ext in ['.png','.webp','.jpg','.jpeg']:
        p=root/f'{name}{ext}'
        if p.is_file(): return p
    return None


def check_visual_review(root,errors):
    path=root/'qa/visual-review.json'
    if not path.is_file(): errors.append('missing qa/visual-review.json'); return
    try:d=read_json(path)
    except Exception as e:errors.append(f'invalid visual-review.json: {e}');return
    if d.get('verdict')!='pass':errors.append('visual-review.json does not record pass')
    if not d.get('reviewer'):errors.append('visual-review.json missing reviewer')
    arts=d.get('artifacts') or []
    if not arts:errors.append('visual-review.json has no reviewed artifacts')
    for rec in arts:
        rel=rec.get('path','');f=root/rel
        if not f.is_file():errors.append(f'visual review artifact missing: {rel}')
        elif rec.get('sha256')!=sha256_file(f):errors.append(f'visual review artifact changed after review: {rel}')


def check_runtime_contract(root,manifest,errors):
    path=root/'qa/runtime-contract.json'
    if not path.is_file():errors.append('missing qa/runtime-contract.json');return
    try:d=read_json(path)
    except Exception as e:errors.append(f'invalid runtime-contract.json: {e}');return
    if d.get('schemaVersion')!=2 or d.get('source')!='browser-probe':errors.append('runtime contract must be schemaVersion 2 from browser-probe evidence')
    entry=root/manifest.get('entry','')
    if entry.is_file() and d.get('entrySha256')!=sha256_file(entry):errors.append('runtime-contract entry hash is stale')
    ev=root/d.get('evidencePath','__missing__')
    if not ev.is_file():errors.append('runtime-contract evidence file missing from package')
    elif d.get('evidenceSha256')!=sha256_file(ev):errors.append('runtime-contract evidence hash is stale')
    for key in ['views','actions','expressions']:
        observed=set(d.get(key) or []);declared=set(manifest.get(key) or []);missing=declared-observed
        if missing:errors.append(f'runtime contract missing declared {key}: {sorted(missing)}')


def check_continuity(root,required,errors,warnings):
    report=root/'qa/view-continuity.json';views=root/'qa/frames/views'
    if not report.is_file():errors.append('missing qa/view-continuity.json');return
    try:d=read_json(report)
    except Exception as e:errors.append(f'invalid view-continuity.json: {e}');return
    hashes=d.get('inputHashes') or {}
    for name in required:
        f=find_image(views,name)
        if not f:errors.append(f'missing view frame: {name}')
        elif hashes.get(name)!=sha256_file(f):errors.append(f'view-continuity report stale for view: {name}')
    if d.get('reviewRequired'):warnings.append('view-continuity metrics request human review')


def check_determinism(root,errors):
    report=root/'qa/determinism.json';qa=root/'qa/determinism'
    if not report.is_file():errors.append('missing qa/determinism.json');return
    try:d=read_json(report)
    except Exception as e:errors.append(f'invalid determinism.json: {e}');return
    if d.get('method')!='forward-reverse-fresh-page':errors.append('determinism report must use forward-reverse-fresh-page method')
    if not d.get('ok'):errors.append('determinism.json reports failure')
    for comp in d.get('comparisons') or []:
        other='reverse' if 'reverse' in comp.get('label','') else 'fresh'
        for pair in comp.get('pairs') or []:
            rel=pair.get('path','');a=qa/'forward'/rel;b=qa/other/rel
            if not a.is_file() or not b.is_file():errors.append(f'determinism evidence missing: {comp.get("label")}:{rel}')
            elif pair.get('baseSha256')!=sha256_file(a) or pair.get('otherSha256')!=sha256_file(b):errors.append(f'determinism report stale: {comp.get("label")}:{rel}')


def check_generated_art(root,manifest,errors):
    meta=root/'assets/atlas.json'
    if not meta.is_file():errors.append('generated-art package missing assets/atlas.json');return
    try:am=read_json(meta)
    except Exception as e:errors.append(f'invalid assets/atlas.json: {e}');return
    if am.get('schemaVersion')!=2:errors.append('atlas metadata schemaVersion must be 2')
    img=root/'assets'/am.get('image','__missing__')
    if not img.is_file():errors.append(f'generated-art atlas image missing: assets/{am.get("image")}')
    norm=am.get('normalization') or {};anchor=am.get('anchor') or {}
    if norm.get('mode')!='single-global-scale':errors.append('atlas must record single-global-scale normalization')
    if anchor.get('mode')!='feet-center':errors.append('atlas must record feet-center anchor')
    clips=am.get('clips') or {}
    observed={
      'actions':set((am.get('actions') or {}).keys()),
      'views':{c.get('view') for c in clips.values()},
      'expressions':{c.get('expression') for c in clips.values()},
    }
    for key in ['actions','views','expressions']:
        missing=set(manifest.get(key) or [])-observed[key]
        if missing:errors.append(f'atlas does not implement declared {key}: {sorted(missing)}')
    for cid,c in clips.items():
        if c.get('playback') not in {'loop','once'}:errors.append(f'clip {cid} has invalid playback')
        if not c.get('frames'):errors.append(f'clip {cid} has no frames')
        for f in c.get('frames') or []:
            if 'anchor' not in f or 'subjectBox' not in f:errors.append(f'clip {cid} frame missing anchor/subjectBox metadata');break


def check_puppet(root,manifest,errors):
    p=root/'assets/puppet.json'
    if not p.is_file():errors.append('raster-puppet package missing assets/puppet.json');return
    try:d=read_json(p)
    except Exception as e:errors.append(f'invalid assets/puppet.json: {e}');return
    if d.get('schemaVersion')!=2 or not isinstance(d.get('views'),dict) or not d['views']:
        errors.append('raster-puppet requires puppet.json schemaVersion 2 with views');return
    impl_views=set(d['views']);impl_actions=set();impl_expr={d.get('defaultExpression','neutral')}
    for view,rig in d['views'].items():
        ids={x.get('id') for x in rig.get('parts') or []}
        if not ids:errors.append(f'puppet view {view} has no parts')
        impl_actions.update((rig.get('poses') or {}).keys())
        for part in rig.get('parts') or []:
            if part.get('parent') and part['parent'] not in ids:errors.append(f'puppet view {view} part {part.get("id")} has unknown parent {part.get("parent")}')
            refs=[part.get('src')]+list((part.get('expressions') or {}).values());impl_expr.update((part.get('expressions') or {}).keys())
            for rel in refs:
                if not rel:errors.append(f'puppet view {view} part {part.get("id")} missing asset path');continue
                # Runtime-generated puppet.json may store paths relative to renderer; source authoring puppet paths are usually relative to assets. Accept both while requiring in-package resolution.
                candidates=[p.parent/rel,(root/manifest.get('entry','')).parent/rel]
                if not any(x.resolve().is_file() and ensure_within(root,x.resolve()) for x in candidates):errors.append(f'missing puppet part asset: {rel}')
    observed={'views':impl_views,'actions':impl_actions,'expressions':impl_expr}
    for key in ['views','actions','expressions']:
        miss=set(manifest.get(key) or [])-observed[key]
        if miss:errors.append(f'puppet does not implement declared {key}: {sorted(miss)}')
    for view in manifest.get('requiredViews') or []:
        rig=d['views'].get(view)
        if not rig:continue
        miss=set(manifest.get('actions') or [])-set((rig.get('poses') or {}).keys())
        if miss:errors.append(f'puppet required view {view} missing declared poses: {sorted(miss)}')

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('package');p.add_argument('--json-out',default='');p.add_argument('--require-qa',action='store_true');p.add_argument('--profile',default='');a=p.parse_args()
    root=Path(a.package).expanduser().resolve();errors=[];warnings=[]
    try:manifest=read_json(root/'character.json')
    except Exception as e:errors.append(f'missing/invalid character.json: {e}');manifest={}
    required=['schemaVersion','id','displayName','description','status','renderMode','entry','views','requiredViews','actions','expressions','api']
    for key in required:
        if key not in manifest:errors.append(f'character.json missing {key}')
    if manifest.get('schemaVersion')!=2:errors.append('schemaVersion must be 2')
    if manifest.get('status')!='ready':errors.append('status must be "ready" for release validation')
    if manifest.get('renderMode') not in VALID_RENDER_MODES:errors.append(f'invalid renderMode: {manifest.get("renderMode")}')
    if not (root/'README.md').is_file():errors.append('ready/shared character package must include README.md with runtime requirements')
    req=manifest.get('requiredViews') if isinstance(manifest.get('requiredViews'),list) else [];views=manifest.get('views') if isinstance(manifest.get('views'),list) else []
    missing=[v for v in req if v not in views]
    if missing:errors.append('requiredViews not implemented in views: '+', '.join(missing))
    if a.profile:
        try:
            prof=read_json(Path(a.profile).expanduser().resolve());expected=prof.get('requiredViews') or []
            if expected and req!=expected:warnings.append(f'package requiredViews differ from profile {prof.get("id","profile")}: expected {expected}, got {req}')
        except Exception as e:errors.append(f'invalid profile: {e}')
    entry_rel=manifest.get('entry','');entry=(root/entry_rel).resolve() if entry_rel else root/'__missing__'
    if entry_rel and not ensure_within(root,entry):errors.append('entry escapes package root')
    if not entry.is_file():errors.append(f'missing renderer entry: {entry_rel or "<unset>"}')
    source=''
    if entry.is_file():
        try:source=entry.read_text(encoding='utf-8')
        except UnicodeDecodeError:warnings.append('renderer entry is not UTF-8; source checks skipped')
    if source:
        if 'TODO' in source or 'not built yet' in source:errors.append('renderer entry still contains draft/stub marker')
        for pattern,label in FORBIDDEN_SOURCE.items():
            if re.search(pattern,source):errors.append(f'renderer uses {label}')
        api=manifest.get('api') or {}
        for name in [api.get('render'),api.get('capabilities')]:
            if name and name not in source:errors.append(f'declared API symbol not found in entry source: {name}')
    for path in iter_files(root):
        if path.suffix.lower() not in {'.js','.mjs','.cjs','.ts','.tsx','.json','.md','.html','.css','.svg','.txt'}:continue
        try:txt=path.read_text(encoding='utf-8')
        except UnicodeDecodeError:continue
        rel=str(path.relative_to(root))
        for regex,label in SECRET_PATTERNS:
            if regex.search(txt):errors.append(f'{rel}: {label}')
        for regex in ABS_PATH_PATTERNS:
            if regex.search(txt):errors.append(f'{rel}: contains absolute local path')
    if manifest.get('renderMode') in {'generated-art','raster-sprites'}:check_generated_art(root,manifest,errors)
    if manifest.get('renderMode')=='raster-puppet':check_puppet(root,manifest,errors)
    if a.require_qa:
        qa=root/'qa'
        for rel in ['views.png','contact-sheet.png']:
            if not (qa/rel).is_file():errors.append(f'missing required QA artifact: qa/{rel}')
        for name in req:
            if not find_image(qa/'frames/views',name):errors.append(f'missing required view render: {name}')
        previews={p.stem for p in (qa/'previews').iterdir()} if (qa/'previews').is_dir() else set()
        for action in manifest.get('actions') or []:
            if action not in previews:errors.append(f'missing QA preview for declared action: {action}')
        check_continuity(root,req,errors,warnings);check_determinism(root,errors);check_runtime_contract(root,manifest,errors);check_visual_review(root,errors)
    result={'ok':not errors,'errors':list(dict.fromkeys(errors)),'warnings':list(dict.fromkeys(warnings)),'checks':{'entry':entry.is_file(),'qaRequired':a.require_qa,'requiredViews':req,'fileCount':sum(1 for _ in iter_files(root))}}
    if a.json_out:write_json(Path(a.json_out).expanduser().resolve(),result)
    print(json.dumps(result,indent=2));
    if errors:raise SystemExit(1)
if __name__=='__main__':main()
