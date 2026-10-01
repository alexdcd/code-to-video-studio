import subprocess,sys,json
from pathlib import Path
from _util import make_runtime_package, hyperframes_export_command
ROOT=Path(__file__).parents[1]
def test_hyperframes_export_is_global_and_seek_safe(tmp_path):
    pkg=make_runtime_package(tmp_path/'character');out=tmp_path/'kit/characters'
    subprocess.run(hyperframes_export_command(pkg,tmp_path),check=True)
    dst=out/'tester';js=(dst/'tester.js').read_text();assert 'export ' not in js;assert 'M.tester=' in js;assert 'window.MAFIA' in js;assert 'assets/kit/characters/tester/atlas.webp' in js;assert 'M.porCuadro' in js;assert 'M.anim.jump' in js;assert 'opts.ancho' in js;assert (dst/'atlas.webp').is_file();assert (dst/'ficha.json').is_file();assert (dst/'demo.html').is_file();assert (dst/'README.md').is_file()
    f=json.loads((dst/'ficha.json').read_text());assert f['tipo']=='personaje'
