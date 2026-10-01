import json,subprocess,sys
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).parents[1]

def subject(path,size,rect):
    path.parent.mkdir(parents=True,exist_ok=True);im=Image.new('RGBA',size,(0,0,0,0));ImageDraw.Draw(im).rectangle(rect,fill='white');im.save(path)

def bbox_in_cell(atlas,cell):
    x,y,w,h=cell;return atlas.crop((x,y,x+w,y+h)).getchannel('A').getbbox()

def test_global_scale_and_feet_anchor_across_different_source_canvases(tmp_path):
    root=tmp_path/'frames';subject(root/'idle/000.png',(512,512),(146,200,366,420));subject(root/'walk/000.png',(384,384),(82,100,302,320))
    out=tmp_path/'atlas.png';meta=tmp_path/'atlas.json';subprocess.run([sys.executable,str(ROOT/'scripts/compose_sprite_atlas.py'),'--frames-root',str(root),'--output',str(out),'--metadata',str(meta),'--cell-width','256','--cell-height','256'],check=True)
    d=json.loads(meta.read_text());assert d['normalization']['mode']=='single-global-scale';assert d['anchor']['mode']=='feet-center'
    atlas=Image.open(out).convert('RGBA');clips=list(d['clips'].values());boxes=[]
    for c in clips:boxes.append(bbox_in_cell(atlas,c['frames'][0]['cell']))
    heights=[b[3]-b[1] for b in boxes];bottoms=[b[3] for b in boxes];centers=[(b[0]+b[2])/2 for b in boxes]
    assert max(heights)-min(heights)<=1
    assert max(bottoms)-min(bottoms)<=1
    assert max(centers)-min(centers)<=1
