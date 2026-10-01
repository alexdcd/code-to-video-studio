import json, subprocess, sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).parents[1]

def img(p,size):
    p.parent.mkdir(parents=True,exist_ok=True);Image.new('RGBA',size,'white').save(p)

def test_build_puppet_manifest_from_parts_and_expression_variants(tmp_path):
    parts=tmp_path/'character/assets/parts'
    for view in ['front','q','side']:
        img(parts/view/'torso.png',(180,240));img(parts/view/'head.png',(170,170));img(parts/view/'head--happy.png',(170,170))
        img(parts/view/'upper-arm-left.png',(50,150));img(parts/view/'forearm-left.png',(44,135));img(parts/view/'hand-left.png',(55,55))
        img(parts/view/'upper-arm-right.png',(50,150));img(parts/view/'forearm-right.png',(44,135));img(parts/view/'hand-right.png',(55,55))
        img(parts/view/'upper-leg-left.png',(58,170));img(parts/view/'lower-leg-left.png',(52,165));img(parts/view/'foot-left.png',(90,45))
        img(parts/view/'upper-leg-right.png',(58,170));img(parts/view/'lower-leg-right.png',(52,165));img(parts/view/'foot-right.png',(90,45))
    out=tmp_path/'character/assets/puppet.json'
    subprocess.run([sys.executable,str(ROOT/'scripts/build_puppet_manifest.py'),'--parts-dir',str(parts),'--output',str(out),'--archetype','humanoid','--canvas','1024x1024'],check=True,stdout=subprocess.DEVNULL)
    d=json.loads(out.read_text())
    assert d['layoutDraft']['requiresPivotQA'] is True
    assert set(d['views'])=={'front','q','side'}
    rig=d['views']['front']; by={p['id']:p for p in rig['parts']}
    assert by['head']['parent']=='torso'
    assert by['forearm-right']['parent']=='upper-arm-right'
    assert 'happy' in by['head']['expressions']
    assert by['head']['pivot'][1] > 100
    assert 'point' in rig['poses'] and 'walk' in rig['poses']
