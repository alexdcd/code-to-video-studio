import json,subprocess,sys
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).parents[1]

def test_chroma_grid_and_atlas(tmp_path):
    # 2x2 generated-style sheet on green chroma.
    im=Image.new('RGB',(200,200),(0,255,0)); d=ImageDraw.Draw(im)
    for r in range(2):
        for c in range(2):
            x=c*100+30; y=r*100+20; d.rectangle((x,y,x+40,y+60),fill=(255,255,255),outline=(0,0,0),width=2)
    raw=tmp_path/'sheet.png'; im.save(raw); clean=tmp_path/'clean.png'
    subprocess.run([sys.executable,str(ROOT/'scripts/remove_chroma_background.py'),str(raw),'--output',str(clean),'--chroma-key','#00FF00'],check=True)
    assert Image.open(clean).convert('RGBA').getchannel('A').getextrema()[0]==0
    cells=tmp_path/'cells'; subprocess.run([sys.executable,str(ROOT/'scripts/extract_grid.py'),str(clean),'--rows','2','--cols','2','--names','idle-0,idle-1,walk-0,walk-1','--output-dir',str(cells)],check=True)
    frames=tmp_path/'frames'; (frames/'idle').mkdir(parents=True); (frames/'walk').mkdir(parents=True)
    for src,dst in [(cells/'idle-0.png',frames/'idle/000.png'),(cells/'idle-1.png',frames/'idle/001.png'),(cells/'walk-0.png',frames/'walk/000.png'),(cells/'walk-1.png',frames/'walk/001.png')]: dst.write_bytes(src.read_bytes())
    subprocess.run([sys.executable,str(ROOT/'scripts/compose_sprite_atlas.py'),'--frames-root',str(frames),'--output',str(tmp_path/'atlas.png'),'--metadata',str(tmp_path/'atlas.json')],check=True)
    meta=json.loads((tmp_path/'atlas.json').read_text()); assert set(meta['actions'])=={'idle','walk'}

def test_fake_transparency_detection(tmp_path):
    im=Image.new('RGB',(128,128),'white'); d=ImageDraw.Draw(im); s=16
    for y in range(0,128,s):
        for x in range(0,128,s): d.rectangle((x,y,x+s-1,y+s-1),fill=(220,220,220) if (x//s+y//s)%2 else (245,245,245))
    path=tmp_path/'fake.png'; im.save(path); r=subprocess.run([sys.executable,str(ROOT/'scripts/detect_fake_transparency.py'),str(path)],capture_output=True,text=True); assert r.returncode==2; assert 'fakeTransparencyLikely' in r.stdout
