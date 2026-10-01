import json, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw
from _util import make_runtime_package, hyperframes_export_command
ROOT=Path(__file__).parents[1]

def test_default_atlas_cells_are_512_for_video(tmp_path):
    frames=tmp_path/'frames/idle';frames.mkdir(parents=True)
    im=Image.new('RGBA',(300,300),(0,0,0,0));ImageDraw.Draw(im).rectangle((100,50,200,260),fill='white');im.save(frames/'000.png')
    out=tmp_path/'atlas.webp';meta=tmp_path/'atlas.json'
    subprocess.run([sys.executable,str(ROOT/'scripts/compose_sprite_atlas.py'),'--frames-root',str(tmp_path/'frames'),'--output',str(out),'--metadata',str(meta)],check=True,stdout=subprocess.DEVNULL)
    d=json.loads(meta.read_text())
    assert d['cellWidth']==512 and d['cellHeight']==512
    assert d['normalization']['normalizedMaxSubject'][1] > 400

def test_hyperframes_sprite_export_has_ancho_on_inner_stage(tmp_path):
    pkg=make_runtime_package(tmp_path/'character');out=tmp_path/'kit/characters'
    subprocess.run(hyperframes_export_command(pkg,tmp_path),check=True,stdout=subprocess.DEVNULL)
    js=(out/'tester/tester.js').read_text()
    assert 'opts.ancho||w' in js
    assert 'class:"tester-stage"' in js
    assert 'transform:scale(${baseScale})' in js
    assert 'gsap.set(c.wrap' in js
    ficha=json.loads((out/'tester/ficha.json').read_text())
    assert 'ancho' in next(iter(ficha['parametros']))
