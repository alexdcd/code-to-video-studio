import json,subprocess,sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).parents[1]
def test_prepare_defaults_to_generated_art_and_three_required_views(tmp_path):
    ref=tmp_path/'ref.png'; Image.new('RGBA',(20,20),'white').save(ref); out=tmp_path/'run'
    subprocess.run([sys.executable,str(ROOT/'scripts/prepare_character_run.py'),'--name','Box Friend','--reference',str(ref),'--profile',str(ROOT/'profiles/generic.json'),'--output-dir',str(out)],check=True)
    req=json.loads((out/'character-request.json').read_text()); assert req['renderMode']=='generated-art'; assert req['requiredViews']==['front','q','side']; assert 'back' in req['views']
