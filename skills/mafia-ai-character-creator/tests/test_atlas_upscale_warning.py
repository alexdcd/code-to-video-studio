import json, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).parents[1]

def test_atlas_warns_when_source_is_upscaled(tmp_path):
    frames=tmp_path/'frames/idle';frames.mkdir(parents=True)
    im=Image.new('RGBA',(260,260),(0,0,0,0));d=ImageDraw.Draw(im);d.rectangle((70,20,190,220),fill='white');im.save(frames/'0.png')
    out=tmp_path/'atlas.webp';meta=tmp_path/'atlas.json'
    r=subprocess.run([sys.executable,str(ROOT/'scripts/compose_sprite_atlas.py'),'--frames-root',str(tmp_path/'frames'),'--output',str(out),'--metadata',str(meta)],check=True,text=True,capture_output=True)
    data=json.loads(meta.read_text())
    assert data['normalization']['upscaled'] is True
    assert data['normalization']['scale']>1
    assert data['qualityWarnings']
    assert 'Atlas upscale' in r.stderr
