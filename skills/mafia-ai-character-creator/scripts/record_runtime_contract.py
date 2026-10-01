#!/usr/bin/env python3
"""Record runtime capabilities only from detailed external browser-probe evidence.

This command intentionally refuses to infer capabilities from character.json.
"""
from __future__ import annotations
import argparse, json, shutil
from pathlib import Path
from _common import read_json, sha256_file, write_json

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--package',required=True);p.add_argument('--evidence',required=True);p.add_argument('--output',default='qa/runtime-contract.json');p.add_argument('--evidence-dest',default='qa/runtime-probe.json');a=p.parse_args()
    root=Path(a.package).expanduser().resolve();manifest_path=root/'character.json';m=read_json(manifest_path);entry=root/m['entry'];src=Path(a.evidence).expanduser().resolve()
    if not src.is_file():raise SystemExit(f'evidence not found: {src}')
    e=read_json(src)
    if e.get('schemaVersion')!=1 or e.get('source')!='browser-probe':raise SystemExit('runtime evidence must come from probe_browser_runtime.mjs')
    if not e.get('ok'):raise SystemExit('runtime probe reports failure')
    if e.get('manifestSha256')!=sha256_file(manifest_path):raise SystemExit('runtime probe manifest hash is stale or missing')
    probes=e.get('probes') or []
    if not probes or any(not isinstance(x,dict) or not x.get('kind') or 'value' not in x or x.get('ok') is not True for x in probes):raise SystemExit('runtime probe must contain detailed successful probes')
    observed={k:[] for k in ['views','actions','expressions']};kindmap={'view':'views','action':'actions','expression':'expressions'}
    for rec in probes:
        if rec['kind'] in kindmap and rec['value'] not in observed[kindmap[rec['kind']]]:observed[kindmap[rec['kind']]].append(rec['value'])
    if e.get('observed')!=observed:raise SystemExit('runtime probe observed summary does not match detailed probes')
    dest=root/a.evidence_dest;dest.parent.mkdir(parents=True,exist_ok=True)
    if src.resolve()!=dest.resolve():shutil.copy2(src,dest)
    report={'schemaVersion':2,'entry':m['entry'],'entrySha256':sha256_file(entry),'source':'browser-probe','evidencePath':a.evidence_dest.replace('\\','/'),'evidenceSha256':sha256_file(dest),
            'views':observed['views'],'actions':observed['actions'],'expressions':observed['expressions'],'probeCount':len(probes)}
    write_json(root/a.output,report);print(json.dumps(report,indent=2))
if __name__=='__main__':main()
