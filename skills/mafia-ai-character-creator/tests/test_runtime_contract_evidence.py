import json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).parents[1]
def test_runtime_contract_cannot_self_validate(tmp_path):
    pkg=tmp_path/'p';(pkg/'renderer').mkdir(parents=True);(pkg/'renderer/character.js').write_text('export function renderCharacter(){}\nexport function getCharacterCapabilities(){}')
    (pkg/'character.json').write_text(json.dumps({'entry':'renderer/character.js'}))
    r=subprocess.run([sys.executable,str(ROOT/'scripts/record_runtime_contract.py'),'--package',str(pkg)],capture_output=True,text=True)
    assert r.returncode!=0 and '--evidence' in r.stderr
