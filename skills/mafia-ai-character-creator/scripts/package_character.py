#!/usr/bin/env python3
"""Validate and create a reproducible ZIP for a Mafia AI Character Creator package."""
from __future__ import annotations

import argparse, json, subprocess, sys, tempfile, zipfile
from pathlib import Path
from _common import iter_files, sha256_file

FIXED_TIME=(1980,1,1,0,0,0)


def main() -> None:
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('package')
    p.add_argument('--output',required=True)
    p.add_argument('--require-qa',action='store_true')
    args=p.parse_args()
    root=Path(args.package).expanduser().resolve(); output=Path(args.output).expanduser().resolve()
    validator=Path(__file__).with_name('validate_character_package.py')
    cmd=[sys.executable,str(validator),str(root)]
    if args.require_qa: cmd.append('--require-qa')
    proc=subprocess.run(cmd,capture_output=True,text=True)
    if proc.returncode:
        sys.stderr.write(proc.stdout); sys.stderr.write(proc.stderr)
        raise SystemExit('package validation failed')

    files=[p for p in iter_files(root) if p.name!='PACKAGE-MANIFEST.json']
    manifest={'schemaVersion':1,'files':[{'path':str(p.relative_to(root)).replace('\\','/'),'sha256':sha256_file(p),'bytes':p.stat().st_size} for p in files]}
    manifest_bytes=(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n').encode('utf-8')
    output.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for path in files:
            arc=str(path.relative_to(root)).replace('\\','/')
            info=zipfile.ZipInfo(arc,FIXED_TIME); info.compress_type=zipfile.ZIP_DEFLATED; info.external_attr=(0o644 & 0xFFFF)<<16
            z.writestr(info,path.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
        info=zipfile.ZipInfo('PACKAGE-MANIFEST.json',FIXED_TIME); info.compress_type=zipfile.ZIP_DEFLATED; info.external_attr=(0o644 & 0xFFFF)<<16
        z.writestr(info,manifest_bytes,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
    print(json.dumps({'ok':True,'output':str(output),'files':len(files)+1},indent=2))

if __name__=='__main__': main()
