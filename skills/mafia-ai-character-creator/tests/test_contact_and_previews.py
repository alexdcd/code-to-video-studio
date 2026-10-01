import subprocess,sys
from pathlib import Path
from _util import draw_character
ROOT=Path(__file__).parents[1]

def test_contact_and_previews(tmp_path):
    frames=tmp_path/'frames';
    for action in ['idle','walk']:
        for i in range(3): draw_character(frames/action/f'{i:03d}.png',shift=i)
    sheet=tmp_path/'contact.png'; previews=tmp_path/'previews'
    subprocess.run([sys.executable,str(ROOT/'scripts/make_contact_sheet.py'),'--input-dir',str(frames),'--output',str(sheet),'--recursive'],check=True)
    subprocess.run([sys.executable,str(ROOT/'scripts/render_animation_previews.py'),'--frames-root',str(frames),'--output-dir',str(previews),'--fps','10'],check=True)
    assert sheet.is_file(); assert (previews/'idle.gif').is_file(); assert (previews/'walk.gif').is_file()
