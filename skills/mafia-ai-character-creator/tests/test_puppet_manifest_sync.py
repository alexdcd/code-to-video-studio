import json, subprocess, sys
from pathlib import Path
from _util import hyperframes_export_command
from PIL import Image
ROOT=Path(__file__).parents[1]

def make_pkg(tmp_path):
    pkg=tmp_path/'character';parts=pkg/'assets/parts/front';parts.mkdir(parents=True)
    for n in ['torso','head']:Image.new('RGBA',(80,100),'white').save(parts/f'{n}.png')
    puppet={'schemaVersion':2,'defaultView':'front','defaultExpression':'neutral','views':{'front':{'canvas':[512,512],'anchor':[256,470],'parts':[{'id':'torso','src':'parts/front/torso.png','parent':None,'x':256,'y':260,'pivot':[40,10],'z':10},{'id':'head','src':'parts/front/head.png','parent':'torso','x':0,'y':0,'pivot':[40,90],'z':30}],'poses':{'idle':{},'point':{}}}}}
    (pkg/'assets/puppet.json').write_text(json.dumps(puppet))
    manifest={'schemaVersion':2,'id':'sync-test','displayName':'Sync Test','description':'Test.','status':'draft','renderMode':'raster-puppet','target':'standalone-web','entry':'renderer/character.js','moduleSystem':'esm','views':['front','q','side'],'requiredViews':['front','q','side'],'actions':['idle','point'],'expressions':['neutral'],'props':[],'api':{'render':'renderCharacter','capabilities':'getCharacterCapabilities'}}
    (pkg/'character.json').write_text(json.dumps(manifest));return pkg

def test_hyperframes_puppet_export_fails_on_stale_manifest_then_can_sync(tmp_path):
    pkg=make_pkg(tmp_path);out=tmp_path/'kit/characters'
    cmd=hyperframes_export_command(pkg,tmp_path)
    r=subprocess.run(cmd,text=True,capture_output=True)
    assert r.returncode!=0 and 'views not implemented' in (r.stderr+r.stdout)
    subprocess.run(cmd+['--sync-manifest'],check=True,stdout=subprocess.DEVNULL)
    m=json.loads((pkg/'character.json').read_text())
    assert m['views']==['front'] and m['requiredViews']==['front']

def test_standalone_puppet_renderer_supports_sync_manifest(tmp_path):
    pkg=make_pkg(tmp_path)
    r=subprocess.run([sys.executable,str(ROOT/'scripts/build_raster_puppet_renderer.py'),str(pkg)],text=True,capture_output=True)
    assert r.returncode!=0
    subprocess.run([sys.executable,str(ROOT/'scripts/build_raster_puppet_renderer.py'),str(pkg),'--sync-manifest'],check=True,stdout=subprocess.DEVNULL)
    m=json.loads((pkg/'character.json').read_text())
    assert m['views']==['front']
