from __future__ import annotations
import json, subprocess, sys, hashlib
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).parents[1]

def hyperframes_export_command(package:Path,project_root:Path,target='code-to-video-studio'):
    return [sys.executable,str(ROOT/'scripts/generate_hyperframes_character.py'),'character',str(package),'--target',target,'--project-root',str(project_root)]

def draw_character(path:Path,shift=0,scale=1.0,side=False,bg=(255,255,255,0),size=(240,300)):
    path.parent.mkdir(parents=True,exist_ok=True); im=Image.new('RGBA',size,bg); d=ImageDraw.Draw(im); cx=size[0]//2+shift; w=int(90*scale); h=int(90*scale)
    top=max(5,size[1]-270); body_y=top+95; leg_bottom=min(size[1]-8,top+245)
    d.rectangle((cx-w//2,top,cx+w//2,top+h),fill='white',outline='black',width=3)
    if side: d.polygon([(cx+w//2,top),(cx+w//2+18,top-10),(cx+w//2+18,top+h-8),(cx+w//2,top+h)],fill=(230,230,230,255),outline='black')
    d.rectangle((cx-30,body_y,cx+30,body_y+80),fill='white',outline='black',width=3); d.rectangle((cx-45,body_y+5,cx-32,body_y+90),fill='white',outline='black',width=3); d.rectangle((cx+32,body_y+5,cx+45,body_y+90),fill='white',outline='black',width=3)
    d.rectangle((cx-25,body_y+80,cx-8,leg_bottom),fill='white',outline='black',width=3); d.rectangle((cx+8,body_y+80,cx+25,leg_bottom),fill='white',outline='black',width=3); d.rectangle((cx-20,top+35,cx-13,top+55),fill='black')
    if not side: d.rectangle((cx+13,top+35,cx+20,top+55),fill='black')
    im.save(path)

def make_release_package(root:Path,actions=None):
    actions=actions or ['idle','think','point','walk']; expressions=['neutral','thinking','surprised','happy']; views=['front','q','side']
    for rel in ['renderer','assets','qa/previews','qa/frames/views','qa/frames/actions','qa/determinism/forward','qa/determinism/reverse','qa/determinism/fresh','references']: (root/rel).mkdir(parents=True,exist_ok=True)
    manifest={'schemaVersion':2,'id':'tester','displayName':'Tester','description':'Test character.','status':'ready','renderMode':'generated-art','target':'standalone-web','entry':'renderer/character.js','moduleSystem':'esm','views':views,'requiredViews':views,'actions':actions,'expressions':expressions,'props':[],'api':{'render':'renderCharacter','capabilities':'getCharacterCapabilities'}}
    (root/'character.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8');(root/'CHARACTER.md').write_text('# Tester\n',encoding='utf-8')
    frames=root/'_frames'
    # Full action set in default view/expression.
    for action in actions:
        for i in range(2):draw_character(frames/'front/neutral'/action/f'{i:03d}.png',shift=i)
    # Evidence that alternate views and expressions are genuinely present in the atlas.
    for view in views[1:]:draw_character(frames/view/'neutral/idle/000.png',side=True)
    for expr in expressions[1:]:draw_character(frames/'front'/expr/'idle/000.png')
    cmd=[sys.executable,str(ROOT/'scripts/compose_sprite_atlas.py'),'--frames-root',str(frames),'--output',str(root/'assets/atlas.webp'),'--metadata',str(root/'assets/atlas.json'),'--columns','4','--once','point']
    subprocess.run(cmd,check=True);subprocess.run([sys.executable,str(ROOT/'scripts/build_sprite_renderer.py'),str(root)],check=True)
    m=json.loads((root/'character.json').read_text());m['status']='ready';(root/'character.json').write_text(json.dumps(m,indent=2),encoding='utf-8')
    for i,name in enumerate(views):draw_character(root/f'qa/frames/views/{name}.png',shift=i-1,side=name!='front')
    subprocess.run([sys.executable,str(ROOT/'scripts/make_view_qa_sheet.py'),'--views-dir',str(root/'qa/frames/views'),'--views',','.join(views),'--output',str(root/'qa/views.png')],check=True)
    subprocess.run([sys.executable,str(ROOT/'scripts/measure_view_continuity.py'),'--views-dir',str(root/'qa/frames/views'),'--views',','.join(views),'--json-out',str(root/'qa/view-continuity.json')],check=True)
    for action in actions:
        for i in range(2):draw_character(root/f'qa/frames/actions/{action}/{i:03d}.png',shift=i)
    subprocess.run([sys.executable,str(ROOT/'scripts/render_animation_previews.py'),'--frames-root',str(root/'qa/frames/actions'),'--output-dir',str(root/'qa/previews'),'--fps','12'],check=True)
    subprocess.run([sys.executable,str(ROOT/'scripts/make_contact_sheet.py'),'--input-dir',str(root/'qa/frames'),'--output',str(root/'qa/contact-sheet.png'),'--recursive'],check=True)
    for i in range(2):
        for mode in ['forward','reverse','fresh']:draw_character(root/f'qa/determinism/{mode}/{i:03d}.png',shift=i)
    subprocess.run([sys.executable,str(ROOT/'scripts/validate_determinism.py'),'--forward',str(root/'qa/determinism/forward'),'--reverse',str(root/'qa/determinism/reverse'),'--fresh',str(root/'qa/determinism/fresh'),'--json-out',str(root/'qa/determinism.json')],check=True)
    evidence=root/'qa/runtime-probe-source.json';probes=[]
    for v in views:probes.append({'kind':'view','value':v,'ok':True})
    for act in actions:probes.append({'kind':'action','value':act,'ok':True})
    for expr in expressions:probes.append({'kind':'expression','value':expr,'ok':True})
    manifest_sha=hashlib.sha256((root/'character.json').read_bytes()).hexdigest(); evidence.write_text(json.dumps({'schemaVersion':1,'source':'browser-probe','manifestSha256':manifest_sha,'ok':True,'observed':{'views':views,'actions':actions,'expressions':expressions},'probes':probes},indent=2),encoding='utf-8')
    subprocess.run([sys.executable,str(ROOT/'scripts/record_runtime_contract.py'),'--package',str(root),'--evidence',str(evidence)],check=True)
    evidence.unlink()
    subprocess.run([sys.executable,str(ROOT/'scripts/record_visual_review.py'),'--package',str(root),'--reviewer','test-reviewer','--verdict','pass'],check=True)
    import shutil;shutil.rmtree(frames)
    return root


def make_runtime_package(root:Path,actions=None):
    actions=actions or ['idle','point']; expressions=['neutral','happy']; views=['front','q','side']
    for rel in ['renderer','assets']: (root/rel).mkdir(parents=True,exist_ok=True)
    manifest={'schemaVersion':2,'id':'tester','displayName':'Tester','description':'Test character.','status':'draft','renderMode':'generated-art','target':'standalone-web','entry':'renderer/character.js','moduleSystem':'esm','views':views,'requiredViews':views,'actions':actions,'expressions':expressions,'props':[],'api':{'render':'renderCharacter','capabilities':'getCharacterCapabilities'}}
    (root/'character.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    frames=root/'_frames'
    for action in actions:
        for i in range(2): draw_character(frames/'front/neutral'/action/f'{i:03d}.png',shift=i,size=(240,300))
    for view in views[1:]: draw_character(frames/view/'neutral/idle/000.png',side=True,size=(240,300))
    draw_character(frames/'front/happy/idle/000.png',size=(240,300))
    subprocess.run([sys.executable,str(ROOT/'scripts/compose_sprite_atlas.py'),'--frames-root',str(frames),'--output',str(root/'assets/atlas.png'),'--metadata',str(root/'assets/atlas.json'),'--cell-width','128','--cell-height','128','--columns','4','--once','point'],check=True,stdout=subprocess.DEVNULL)
    subprocess.run([sys.executable,str(ROOT/'scripts/build_sprite_renderer.py'),str(root)],check=True,stdout=subprocess.DEVNULL)
    import shutil; shutil.rmtree(frames)
    return root
