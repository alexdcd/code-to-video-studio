# Script reference

Core requirement: Python 3.10+ and Pillow.

## Run / package

- `prepare_character_run.py` — prepare a reproducible character run.
- `scaffold_character.py` — create a draft package.
- `validate_character_package.py` — release gate for portability, runtime/assets, QA evidence, and determinism.
- `package_character.py` — release-gated reproducible ZIP with SHA-256 manifest.
- `validate_skill.py` — self-check the public skill distribution.

## Generated-art route

- `detect_fake_transparency.py` — detect rendered checkerboards masquerading as alpha.
- `remove_chroma_background.py` — convert flat chroma to real alpha.
- `despill_chroma_edges.py` — fast edge despill using Pillow channel operations.
- `extract_grid.py` — deterministic equal-grid slicing.
- `extract_alpha_components.py` — extract irregular connected transparent components, cluster visual rows robustly, and emit a labelled QA contact sheet.
- `extract_motion_strip.py` — deterministic strip slicing.
- `compose_sprite_atlas.py` — global-scale, feet-anchored atlas + clip metadata, with explicit upscale quality warnings.
- `build_sprite_renderer.py` — generate the standalone ESM runtime + demo/runtime README.

## Raster-puppet route

- `build_puppet_manifest.py` — create a first-pass `puppet.json` from cropped parts, with semantic hierarchy/pivots, content bounds, and walk-a/walk-b cycle poses for humanoid rigs.
- `build_raster_puppet_renderer.py` — build a deterministic DOM/CSS part hierarchy from `assets/puppet.json`; fails on stale manifest claims unless `--sync-manifest` is explicitly requested.

## Runtime adapters

- `generate_hyperframes_character.py` — export generated-art **or raster-puppet** packages for a configured HyperFrames target with `ancho`, `ficha.json`, demo and README. Puppet `ancho` uses visible content bounds, `ciclo()` supports repeated pose cycles, `--sync-manifest` intentionally reconciles stale puppet declarations, and `--finalize` applies the target's optional version/build/catalog policy.

## QA

- `inspect_frames.py` — clipping/empty/geometry diagnostics.
- `make_contact_sheet.py` — visual overview.
- `make_view_qa_sheet.py` — required-view sheet.
- `measure_view_continuity.py` — continuity metrics + source hashes.
- `render_animation_previews.py` — per-action GIF previews.
- `render_browser_frames.mjs` — Playwright DOM/PNG renderer supporting forward/reverse/fresh modes.
- `probe_browser_runtime.mjs` — exercises declared views/actions/expressions against the actual browser runtime.
- `validate_determinism.py` — compare forward/reverse/fresh-page renders.
- `record_runtime_contract.py` — records only externally probed runtime capabilities and hashes the evidence.
- `record_visual_review.py` — binds a visual verdict to exact reviewed artifact hashes.
