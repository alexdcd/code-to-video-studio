import json,subprocess,sys
from pathlib import Path
from _util import draw_character
SCRIPT=Path(__file__).parents[1]/'scripts'/'validate_determinism.py'
def test_forward_reverse_fresh_pass_and_fail(tmp_path):
    dirs={x:tmp_path/x for x in ['forward','reverse','fresh']}
    for d in dirs.values(): d.mkdir()
    for i in range(2):
        for d in dirs.values(): draw_character(d/f'{i:03d}.png',shift=i)
    out=tmp_path/'ok.json'; subprocess.run([sys.executable,str(SCRIPT),'--forward',str(dirs['forward']),'--reverse',str(dirs['reverse']),'--fresh',str(dirs['fresh']),'--json-out',str(out)],check=True); assert json.loads(out.read_text())['ok']
    draw_character(dirs['reverse']/'001.png',shift=9); bad=tmp_path/'bad.json'; r=subprocess.run([sys.executable,str(SCRIPT),'--forward',str(dirs['forward']),'--reverse',str(dirs['reverse']),'--fresh',str(dirs['fresh']),'--json-out',str(bad)]); assert r.returncode!=0
