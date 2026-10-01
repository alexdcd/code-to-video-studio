import json, subprocess, sys
from pathlib import Path
from _util import hyperframes_export_command
from PIL import Image
ROOT=Path(__file__).parents[1]

def test_puppet_export_sizes_by_visible_content_and_exposes_cycle(tmp_path):
    pkg=tmp_path/'character';parts=pkg/'assets/parts/front';parts.mkdir(parents=True)
    Image.new('RGBA',(200,300),'white').save(parts/'torso.png')
    Image.new('RGBA',(180,180),'white').save(parts/'head.png')
    puppet={'schemaVersion':2,'defaultView':'front','defaultExpression':'neutral','views':{'front':{'canvas':[1024,1024],'anchor':[512,900],'parts':[{'id':'torso','src':'parts/front/torso.png','parent':None,'x':512,'y':500,'pivot':[100,20],'z':10},{'id':'head','src':'parts/front/head.png','parent':'torso','x':0,'y':0,'pivot':[90,160],'z':30}], 'poses':{'idle':{},'walk':{},'walk-a':{},'walk-b':{}}}}}
    (pkg/'assets/puppet.json').write_text(json.dumps(puppet))
    manifest={'schemaVersion':2,'id':'width-test','displayName':'Width Test','description':'Test.','status':'draft','renderMode':'raster-puppet','target':'standalone-web','entry':'renderer/character.js','moduleSystem':'esm','views':['front'],'requiredViews':['front'],'actions':['idle','walk'],'expressions':['neutral'],'props':[],'api':{'render':'renderCharacter','capabilities':'getCharacterCapabilities'}}
    (pkg/'character.json').write_text(json.dumps(manifest))
    out=tmp_path/'kit/characters'
    subprocess.run(hyperframes_export_command(pkg,tmp_path),check=True,stdout=subprocess.DEVNULL)
    pp=json.loads((out/'width-test/puppet.json').read_text());bounds=pp['views']['front']['contentBounds']
    assert bounds[2]-bounds[0] < 1024
    js=(out/'width-test/width-test.js').read_text()
    assert 'bounds=first.contentBounds' in js
    assert 'baseScale=ancho/nativeW' in js
    assert 'ciclo(tl,c,at,dur' in js
    ficha=json.loads((out/'width-test/ficha.json').read_text())
    assert 'ancho visual' in ficha['parametros']['insertar(padre,prefijo,{ancho,estilo,base,action,view,expression})']
    assert 'ciclo(tl,c,t,dur,poses,opts)' in ficha['parametros']
