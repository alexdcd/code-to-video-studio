import json, subprocess, sys
from pathlib import Path
from _util import hyperframes_export_command
from PIL import Image
ROOT=Path(__file__).parents[1]

def test_hyperframes_exports_raster_puppet_as_global_mafia_runtime(tmp_path):
    pkg=tmp_path/'character';parts=pkg/'assets/parts/front';parts.mkdir(parents=True);(pkg/'renderer').mkdir()
    for n in ['torso','head','head--happy','arm-left','arm-right','leg-left','leg-right']:
        Image.new('RGBA',(48,64),'white').save(parts/f'{n}.webp','WEBP',lossless=True)
    puppet={'schemaVersion':2,'defaultView':'front','defaultExpression':'neutral','views':{}}
    def rig(view):
        return {'canvas':[512,512],'anchor':[256,480],'parts':[
          {'id':'torso','src':'parts/front/torso.webp','parent':None,'x':256,'y':260,'pivot':[24,8],'z':10},
          {'id':'head','src':'parts/front/head.webp','expressions':{'happy':'parts/front/head--happy.webp'},'parent':'torso','x':0,'y':0,'pivot':[24,56],'z':30},
          {'id':'arm-left','src':'parts/front/arm-left.webp','parent':'torso','x':-35,'y':20,'pivot':[24,8],'z':5},
          {'id':'arm-right','src':'parts/front/arm-right.webp','parent':'torso','x':35,'y':20,'pivot':[24,8],'z':20},
          {'id':'leg-left','src':'parts/front/leg-left.webp','parent':'torso','x':-15,'y':55,'pivot':[24,8],'z':5},
          {'id':'leg-right','src':'parts/front/leg-right.webp','parent':'torso','x':15,'y':55,'pivot':[24,8],'z':20}],
          'poses':{'idle':{},'point':{'arm-right':{'rotation':-55}}}}
    # Reuse art in this synthetic test but keep three logical views.
    for v in ['front','q','side']: puppet['views'][v]=rig(v)
    (pkg/'assets/puppet.json').write_text(json.dumps(puppet))
    manifest={'schemaVersion':2,'id':'puppet-test','displayName':'Puppet Test','description':'Test puppet.','status':'draft','renderMode':'raster-puppet','target':'standalone-web','entry':'renderer/character.js','moduleSystem':'esm','views':['front','q','side'],'requiredViews':['front','q','side'],'actions':['idle','point'],'expressions':['neutral','happy'],'props':[],'api':{'render':'renderCharacter','capabilities':'getCharacterCapabilities'}}
    (pkg/'character.json').write_text(json.dumps(manifest))
    out=tmp_path/'kit/characters'
    subprocess.run(hyperframes_export_command(pkg,tmp_path),check=True,stdout=subprocess.DEVNULL)
    dst=out/'puppet-test';js=(dst/'puppet-test.js').read_text()
    assert 'export ' not in js
    assert 'M.puppetTest=' in js
    assert 'M.porCuadro' in js
    assert 'M.anim.jump' in js
    assert 'posar(c,state={})' in js
    assert 'opts.ancho' in js
    assert (dst/'puppet.json').is_file() and (dst/'parts/front/head.webp').is_file()
    ficha=json.loads((dst/'ficha.json').read_text())
    assert 'posar(c,state)' in ficha['parametros']
