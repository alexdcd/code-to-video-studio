import json,subprocess,sys,zipfile
from pathlib import Path
from _util import make_release_package
ROOT=Path(__file__).parents[1]
def test_validate_and_package(tmp_path):
    pkg=make_release_package(tmp_path/'character'); report=pkg/'qa/validation.json'
    subprocess.run([sys.executable,str(ROOT/'scripts/validate_character_package.py'),str(pkg),'--require-qa','--json-out',str(report)],check=True); assert json.loads(report.read_text())['ok']
    out=tmp_path/'character.zip'; subprocess.run([sys.executable,str(ROOT/'scripts/package_character.py'),str(pkg),'--output',str(out),'--require-qa'],check=True)
    with zipfile.ZipFile(out) as z: assert 'PACKAGE-MANIFEST.json' in z.namelist()
def test_rejects_stale_visual_review(tmp_path):
    pkg=make_release_package(tmp_path/'character'); (pkg/'qa/views.png').write_bytes(b'changed')
    r=subprocess.run([sys.executable,str(ROOT/'scripts/validate_character_package.py'),str(pkg),'--require-qa'],capture_output=True,text=True); assert r.returncode!=0; assert 'changed after review' in r.stdout
