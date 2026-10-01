import subprocess,sys,json
from pathlib import Path
from _util import make_runtime_package, hyperframes_export_command
ROOT=Path(__file__).parents[1]

def test_finalize_target_bumps_version_and_runs_configured_commands(tmp_path):
    pkg=make_runtime_package(tmp_path/'character')
    repo=tmp_path/'repo';out=repo/'kit/custom-characters';out.mkdir(parents=True)
    (repo/'kit/VERSION').write_text('0.7.3\n')
    (repo/'scripts/lib').mkdir(parents=True)
    (repo/'scripts/lib/kit-build.mjs').write_text("import fs from 'node:fs';fs.writeFileSync('kit/build-ran','yes');")
    (repo/'scripts/lib/catalog.mjs').write_text("import fs from 'node:fs';fs.writeFileSync('kit/catalog-ran','yes');")
    target_dir=repo/'tools/skill-targets';target_dir.mkdir(parents=True)
    (target_dir/'fixture-target.json').write_text(json.dumps({'schemaVersion':1,'id':'fixture-target','characterDir':'kit/custom-characters','assetPrefix':'assets/custom-characters','runtime':'TEST_RUNTIME','versionFile':'kit/VERSION','versionBump':'minor','buildCommand':['node','scripts/lib/kit-build.mjs'],'catalogCommand':['node','scripts/lib/catalog.mjs']}))
    subprocess.run(hyperframes_export_command(pkg,repo,target='fixture-target')+['--finalize'],check=True,stdout=subprocess.DEVNULL)
    assert (repo/'kit/VERSION').read_text().strip()=='0.8.0'
    assert (repo/'kit/build-ran').read_text()=='yes'
    assert (repo/'kit/catalog-ran').read_text()=='yes'
