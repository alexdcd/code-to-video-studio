import json,subprocess,sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).parents[1]
S=ROOT/'scripts'


def run(*args,check=True):
    return subprocess.run([sys.executable,*map(str,args)],check=check,capture_output=True,text=True)


def test_layer_option_expands_profile_layers_and_keeps_explicit_actions(tmp_path):
    out=tmp_path/'run'
    run(S/'prepare_character_run.py','--name','Box','--profile',ROOT/'profiles/generic.json','--layer','presence,communication','--action','walk','--output-dir',out)
    req=json.loads((out/'character-request.json').read_text())
    assert req['actionLayers']==['presence','communication']
    for a in ['idle','blink','talk','nod','point','walk']: assert a in req['actions']
    assert 'sit' not in req['actions']


def test_unknown_layer_fails_with_available_layers(tmp_path):
    r=run(S/'prepare_character_run.py','--name','Box','--profile',ROOT/'profiles/generic.json','--layer','nope','--output-dir',tmp_path/'run',check=False)
    assert r.returncode!=0 and 'presence' in (r.stderr+r.stdout)


def test_catalog_actions_cover_every_profile_layer():
    prof=json.loads((ROOT/'profiles/generic.json').read_text())
    text=(ROOT/prof['motionCatalog']).read_text()
    for layer,actions in prof['actionLayers'].items():
        for a in actions: assert f'`{a}`' in text,(layer,a)


def _part(path,size,color):
    path.parent.mkdir(parents=True,exist_ok=True); Image.new('RGBA',size,color).save(path)


def test_underscore_qa_files_are_not_puppet_parts(tmp_path):
    front=tmp_path/'parts/front'
    _part(front/'torso.png',(100,140),(50,60,120,255)); _part(front/'head.png',(90,90),(240,220,200,255))
    Image.new('RGB',(1040,1160),'white').save(front/'_components-qa.png')
    out=tmp_path/'puppet.json'; run(S/'build_puppet_manifest.py','--parts-dir',tmp_path/'parts','--output',out)
    ids=[p['id'] for p in json.loads(out.read_text())['views']['front']['parts']]
    assert ids==['torso','head'] or sorted(ids)==['head','torso']


def test_face_layers_are_children_of_head(tmp_path):
    front=tmp_path/'parts/front'
    _part(front/'torso.png',(100,140),(50,60,120,255)); _part(front/'head.png',(90,90),(240,220,200,255))
    _part(front/'mouth.png',(30,12),(0,0,0,255)); _part(front/'mouth--open.png',(30,20),(0,0,0,255)); _part(front/'eyes.png',(50,14),(255,255,255,255))
    out=tmp_path/'puppet.json'; run(S/'build_puppet_manifest.py','--parts-dir',tmp_path/'parts','--output',out)
    parts={p['id']:p for p in json.loads(out.read_text())['views']['front']['parts']}
    assert parts['mouth']['parent']=='head' and parts['eyes']['parent']=='head'
    assert parts['mouth']['expressions']['open'].endswith('mouth--open.png')
    assert parts['mouth']['y']<0


def test_atlas_ignores_underscore_images(tmp_path):
    frames=tmp_path/'frames/idle'; frames.mkdir(parents=True)
    for i in range(2):
        im=Image.new('RGBA',(100,100),(0,0,0,0)); im.paste(Image.new('RGBA',(40,60),(200,30,30,255)),(30,40)); im.save(frames/f'idle-{i}.png')
    Image.new('RGBA',(300,300),(255,255,255,255)).save(frames/'_qa.png')
    run(S/'compose_sprite_atlas.py','--frames-root',tmp_path/'frames','--output',tmp_path/'a.png','--metadata',tmp_path/'a.json')
    meta=json.loads((tmp_path/'a.json').read_text()); assert meta['frameCount']==2
