#!/usr/bin/env python3
"""Record a traceable visual QA decision against hashes of the reviewed artifacts."""
from __future__ import annotations
import argparse, json
from pathlib import Path
from _common import sha256_file, write_json

def main():
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('--package',required=True); p.add_argument('--reviewer',required=True); p.add_argument('--verdict',required=True,choices=['pass','fail']); p.add_argument('--note',default=''); p.add_argument('--artifact',action='append',default=[]); p.add_argument('--output',default='qa/visual-review.json'); a=p.parse_args()
    root=Path(a.package).expanduser().resolve(); rels=a.artifact or ['qa/views.png','qa/contact-sheet.png']
    # Include all previews by default.
    if not a.artifact:
        prev=root/'qa/previews'
        if prev.is_dir(): rels += [str(x.relative_to(root)) for x in sorted(prev.iterdir()) if x.is_file()]
    reviewed=[]
    for rel in rels:
        f=(root/rel).resolve()
        if not f.is_file(): raise SystemExit(f'missing reviewed artifact: {rel}')
        reviewed.append({'path':str(f.relative_to(root)),'sha256':sha256_file(f)})
    report={'schemaVersion':1,'reviewer':a.reviewer,'verdict':a.verdict,'note':a.note,'artifacts':reviewed}
    write_json(root/a.output,report); print(json.dumps(report,indent=2))
    if a.verdict!='pass': raise SystemExit(1)
if __name__=='__main__': main()
