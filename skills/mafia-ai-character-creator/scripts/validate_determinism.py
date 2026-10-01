#!/usr/bin/env python3
"""Validate seek-safety by comparing forward-order, reverse-order, and fresh-page renders."""
from __future__ import annotations
import argparse, json
from pathlib import Path
from _common import image_files, open_rgba, pixel_difference, sha256_file, write_json

def relmap(root:Path): return {str(p.relative_to(root)):p for p in image_files(root,recursive=True)}

def compare(label,base,other,max_mean,max_chan):
    errors=[]; pairs=[]
    if set(base)!=set(other): errors.append(f'{label}: file sets differ')
    for key in sorted(set(base)&set(other)):
        m=pixel_difference(open_rgba(base[key]),open_rgba(other[key])); rec={'path':key,**m,'baseSha256':sha256_file(base[key]),'otherSha256':sha256_file(other[key])}; pairs.append(rec)
        if not m['sameSize']: errors.append(f'{label}:{key}: size mismatch')
        elif m['meanDelta']>max_mean or m['maxChannelDelta']>max_chan: errors.append(f'{label}:{key}: mismatch mean={m["meanDelta"]:.6f} max={m["maxChannelDelta"]}')
    return {'label':label,'ok':not errors,'errors':errors,'pairs':pairs}

def main():
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('--forward',required=True); p.add_argument('--reverse',required=True); p.add_argument('--fresh',required=True); p.add_argument('--json-out',required=True); p.add_argument('--max-mean-delta',type=float,default=0); p.add_argument('--max-channel-delta',type=int,default=0); a=p.parse_args()
    maps={k:relmap(Path(v).expanduser().resolve()) for k,v in [('forward',a.forward),('reverse',a.reverse),('fresh',a.fresh)]}
    r1=compare('forward-vs-reverse',maps['forward'],maps['reverse'],a.max_mean_delta,a.max_channel_delta); r2=compare('forward-vs-fresh',maps['forward'],maps['fresh'],a.max_mean_delta,a.max_channel_delta)
    errors=[*r1['errors'],*r2['errors']]; result={'schemaVersion':2,'method':'forward-reverse-fresh-page','ok':not errors,'errors':errors,'comparisons':[r1,r2]}; write_json(Path(a.json_out).expanduser().resolve(),result); print(json.dumps(result,indent=2));
    if errors: raise SystemExit(1)
if __name__=='__main__': main()
