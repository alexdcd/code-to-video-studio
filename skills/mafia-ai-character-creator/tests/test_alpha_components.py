import subprocess,sys
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).parents[1]
def test_irregular_alpha_component_extraction(tmp_path):
    im=Image.new('RGBA',(500,300),(0,0,0,0));d=ImageDraw.Draw(im);d.rectangle((20,30,130,250),fill='white');d.rectangle((190,10,310,180),fill='white');d.rectangle((355,80,490,290),fill='white');src=tmp_path/'sheet.png';im.save(src);out=tmp_path/'out'
    subprocess.run([sys.executable,str(ROOT/'scripts/extract_alpha_components.py'),str(src),'--output-dir',str(out),'--names','a,b,c','--padding','0'],check=True)
    assert [p.name for p in sorted(out.glob('*.png')) if not p.name.startswith('_')]==['a.png','b.png','c.png']
    assert (out/'_components-qa.png').is_file()
    assert Image.open(out/'a.png').width<150 and Image.open(out/'c.png').height>190
