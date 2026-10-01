import json,subprocess,sys,time
from pathlib import Path
from _util import draw_character
ROOT=Path(__file__).parents[1]
def test_view_sheet_continuity_and_speed(tmp_path):
    views=tmp_path/'views'; views.mkdir()
    for i,name in enumerate(['front','q','side']): draw_character(views/f'{name}.png',shift=i-1,side=name!='front')
    sheet=tmp_path/'views.png'; report=tmp_path/'continuity.json'; start=time.time()
    subprocess.run([sys.executable,str(ROOT/'scripts/make_view_qa_sheet.py'),'--views-dir',str(views),'--views','front,q,side','--output',str(sheet)],check=True)
    subprocess.run([sys.executable,str(ROOT/'scripts/measure_view_continuity.py'),'--views-dir',str(views),'--views','front,q,side','--json-out',str(report)],check=True)
    assert time.time()-start<5; data=json.loads(report.read_text()); assert data['inputHashes'].keys()=={'front','q','side'}
