#!/usr/bin/env python3
"""Self-check Mafia AI Character Creator before public distribution."""
from __future__ import annotations
import argparse, json
from pathlib import Path

REQUIRED=[
 'SKILL.md','README.md','CHANGELOG.md','CONTRIBUTING.md','LICENSE.txt','NOTICE.md','THIRD_PARTY_NOTICES.md','VERSION','requirements.txt','requirements-dev.txt',
 'references/character-contract.md','references/qa-rubric.md','references/render-modes.md','references/view-system.md','references/generated-art-workflow.md','references/raster-puppet-workflow.md','references/runtime-requirements.md','references/motion-catalog.md','references/upstream-map.md',
 'profiles/generic.json','schemas/character.schema.json','schemas/profile.schema.json','adapters/hyperframes.md','adapters/standalone-web.md','adapters/code-to-video-studio/target.json','adapters/code-to-video-studio/README.md',
 'scripts/prepare_character_run.py','scripts/scaffold_character.py','scripts/detect_fake_transparency.py','scripts/remove_chroma_background.py','scripts/despill_chroma_edges.py',
 'scripts/extract_grid.py','scripts/extract_alpha_components.py','scripts/extract_motion_strip.py','scripts/compose_sprite_atlas.py','scripts/build_sprite_renderer.py','scripts/build_puppet_manifest.py','scripts/build_raster_puppet_renderer.py',
 'scripts/inspect_frames.py','scripts/make_contact_sheet.py','scripts/make_view_qa_sheet.py','scripts/measure_view_continuity.py','scripts/render_animation_previews.py',
 'scripts/render_browser_frames.mjs','scripts/probe_browser_runtime.mjs','scripts/validate_determinism.py','scripts/record_runtime_contract.py','scripts/record_visual_review.py',
 'scripts/generate_hyperframes_character.py','scripts/validate_character_package.py','scripts/package_character.py',
 'templates/raster-puppet/puppet.json.template','browser-tools/package.json','agents/openai.yaml','agents/claude-code.md','agents/codex.md','agents/generic.md'
]

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('skill',nargs='?',default='.');a=p.parse_args();root=Path(a.skill).expanduser().resolve();errors=[]
    for rel in REQUIRED:
        if not (root/rel).is_file():errors.append(f'missing {rel}')
    for path in sorted((root/'scripts').glob('*.py')):
        try:compile(path.read_text(encoding='utf-8'),str(path),'exec')
        except Exception as e:errors.append(f'{path.name}: compile failed: {e}')
    for path in list((root/'profiles').glob('*.json'))+list((root/'schemas').glob('*.json'))+[root/'browser-tools/package.json',root/'adapters/code-to-video-studio/target.json']:
        try:json.loads(path.read_text(encoding='utf-8'))
        except Exception as e:errors.append(f'{path.relative_to(root)}: invalid JSON: {e}')
    skill=(root/'SKILL.md').read_text(encoding='utf-8') if (root/'SKILL.md').is_file() else ''
    readme=(root/'README.md').read_text(encoding='utf-8') if (root/'README.md').is_file() else ''
    if not skill.startswith('---\nname: mafia-ai-character-creator\n'):errors.append('SKILL.md frontmatter missing/incorrect')
    if 'profiles/mafia-ia' in skill or (root/'profiles/mafia-ia.example.json').exists():errors.append('private Mafia IA profile leaked into public core')
    for phrase in ['What a generated character needs to work after you share it','raster-puppet','HyperFrames export']:
        if phrase not in readme:errors.append(f'README missing public runtime guidance: {phrase}')
    if (root/'VERSION').is_file() and (root/'VERSION').read_text().strip()!='1.4.0':errors.append('VERSION must be 1.4.0 for this release')
    result={'ok':not errors,'errors':errors,'version':(root/'VERSION').read_text().strip() if (root/'VERSION').is_file() else None,'name':'mafia-ai-character-creator'}
    print(json.dumps(result,indent=2));
    if errors:raise SystemExit(1)
if __name__=='__main__':main()
