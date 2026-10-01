import json,subprocess
from pathlib import Path
from _util import make_runtime_package

def test_generated_runtime_handles_once_variants_and_module_relative_asset(tmp_path):
    pkg=make_runtime_package(tmp_path/'character');src=(pkg/'renderer/character.js').read_text()
    assert 'new URL(CHARACTER.spriteImage, import.meta.url)' in src
    assert "clip.playback==='once'" in src
    assert 'state.actionTime' in src and 'state.actionStart' in src
    assert 'state.view' in src and 'state.expression' in src
    assert 'resolveCharacterState' in src and 'resolveCharacterFrame' in src
    uri=(pkg/'renderer/character.js').resolve().as_uri()
    js=f'''import({json.dumps(uri)}).then(m=>{{
      const a=m.resolveCharacterFrame(99,{{action:'point',view:'front',expression:'neutral'}});
      const b=m.resolveCharacterFrame(99,{{action:'point',view:'front',expression:'neutral',actionTime:999}});
      const q=m.resolveCharacterFrame(0,{{action:'idle',view:'q',expression:'neutral'}});
      const h=m.resolveCharacterFrame(0,{{action:'idle',view:'front',expression:'happy'}});
      console.log(JSON.stringify({{a,b,q,h}}));
    }})'''
    r=subprocess.run(['node','--input-type=module','-e',js],capture_output=True,text=True,check=True)
    d=json.loads(r.stdout)
    assert d['a']['action']=='point' and d['a']['source']=='000.png'  # one-shot starts at local frame 0, not global-time phase
    assert d['b']['action']=='point' and d['b']['source']=='001.png'  # one-shot clamps to its final frame
    assert d['q']['view']=='q'
    assert d['h']['expression']=='happy'
