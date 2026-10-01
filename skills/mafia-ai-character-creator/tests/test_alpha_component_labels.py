import json, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).parents[1]

def test_alpha_components_group_rows_by_visual_center_and_write_labelled_qa(tmp_path):
    # Two visually centred rows with very different part heights/top edges.
    im=Image.new('RGBA',(600,420),(0,0,0,0));d=ImageDraw.Draw(im)
    # Row 1 centre ~= 110: tall, short, medium
    d.rectangle((30,30,100,190),fill='white')
    d.rectangle((220,80,290,140),fill='white')
    d.rectangle((420,55,490,165),fill='white')
    # Row 2 centre ~= 315 with similarly mixed heights.
    d.rectangle((40,245,110,385),fill='white')
    d.rectangle((230,285,300,345),fill='white')
    d.rectangle((430,260,500,370),fill='white')
    src=tmp_path/'sheet.png';im.save(src);out=tmp_path/'parts';report=tmp_path/'report.json'
    names='r1-a,r1-b,r1-c,r2-a,r2-b,r2-c'
    subprocess.run([sys.executable,str(ROOT/'scripts/extract_alpha_components.py'),str(src),'--output-dir',str(out),'--names',names,'--json-out',str(report),'--connect-radius','0','--padding','0'],check=True,stdout=subprocess.DEVNULL)
    data=json.loads(report.read_text())
    assert [x['name'] for x in data['components']]==names.split(',')
    # Each name must stay left-to-right within the intended visual row.
    assert [x['box'][0] for x in data['components'][:3]]==[30,220,420]
    assert [x['box'][0] for x in data['components'][3:]]==[40,230,430]
    assert data['reviewRequired'] is True
    assert Path(data['qaSheet']).is_file()
