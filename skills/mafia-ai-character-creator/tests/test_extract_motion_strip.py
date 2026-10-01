import subprocess,sys
from pathlib import Path
from PIL import Image
SCRIPT=Path(__file__).parents[1]/'scripts'/'extract_motion_strip.py'

def test_extract_strip(tmp_path):
    im=Image.new('RGBA',(80,20),(0,0,0,0))
    for i in range(4):
        for x in range(i*20,(i+1)*20):
            for y in range(20): im.putpixel((x,y),(i*50,0,0,255))
    src=tmp_path/'strip.png'; im.save(src); out=tmp_path/'frames'
    subprocess.run([sys.executable,str(SCRIPT),str(src),'--frames','4','--output-dir',str(out)],check=True)
    files=sorted(out.glob('*.png')); assert len(files)==4
    assert Image.open(files[2]).size==(20,20)
