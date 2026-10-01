# Changelog

## 1.4.0

- Added `references/motion-catalog.md`: standard actions in five layers (presence, locomotion, communication, emotions, interaction) with kind, typical length, sprite/puppet suitability and honest tooling status (`yes` / `manual` / `planned`), plus starter sets per video type, independent-layer guidance and a seek-safe talk snippet.
- Profiles gained `actionLayers` and `motionCatalog`; `prepare_character_run.py --layer presence,communication` expands them into requested actions.
- SKILL.md tells the agent to pick actions from the catalog, use its names and avoid generating `avoid`-rated actions as AI sprites.
- `build_puppet_manifest.py` treats `eyes`, `brows`, `mouth` and `nose` as children of `head` with draft positions.
- Fixed: QA output whose name starts with `_` (e.g. `_components-qa.png`, written by the documented extraction command into the parts folder) was picked up as a puppet part or atlas frame and corrupted `contentBounds`/`ancho`. Such files are now ignored everywhere.
- Action-sheet prompt asks for one action per sheet and fewer, larger frames.

## 1.3.1

- Fixed silent alpha-component mislabelling risk by clustering visual rows from vertical centres/overlap instead of top-edge buckets.
- `extract_alpha_components.py` now emits a labelled `_components-qa.png` contact sheet by default and marks named extraction as review-required.
- Sprite atlas composition now records/prints a quality warning whenever normalization upscales source art above 1×; 512 px cells are no longer presented as added detail.
- Raster-puppet manifests now record visible `contentBounds` / `contentSize`; HyperFrames `ancho` scales the visible neutral character width instead of the authoring canvas.
- Humanoid puppet drafts now include `walk-a` / `walk-b`, and HyperFrames puppet exports expose seek-safe `ciclo()` for repeated pose cycles.
- HyperFrames and standalone puppet builders now reject stale declared views/actions instead of silently falling back; `--sync-manifest` is available as an explicit reconciliation action.
- Added regression tests for row labelling, QA sheets, upscale warnings, visible-width sizing, puppet cycles, and manifest synchronization.

## 1.3.0

- Raised generated-art atlas default cells from 256×256 to **512×512** for 1080p video; documented 768–1024 for close-up protagonists.
- HyperFrames generated-art exports now support `insertar(..., { ancho })` with base scale isolated from wrapper squash/jump acting.
- Added first-class **HyperFrames raster-puppet export** with a target-configured global runtime, `posar`, seek-safe pose interpolation, `ancho`, and optional acting helpers.
- Added `build_puppet_manifest.py` plus a full raster-puppet generation workflow and prompts for non-overlapping part sheets and expression variants.
- Added opt-in target finalization for configured version/build/catalog policies; manual post-export steps remain documented.
- Added regression coverage for video-ready atlas defaults, size control, puppet manifest generation, and puppet HyperFrames export.

## 1.2.0

- Fixed cross-action sprite scale drift by using one global atlas scale.
- Added common feet-center anchoring and recorded anchor/normalization data in `atlas.json`.
- Upgraded atlas metadata to schema v2 with clips keyed by view + expression + action.
- Added loop/once playback semantics and action-local time to the generated runtime.
- One-shot actions now begin at frame 0 when no local time is supplied and clamp at the final frame when advanced.
- Generated runtime now resolves `view` and `expression` instead of ignoring them.
- Atlas URL now resolves relative to the ESM renderer through `import.meta.url`.
- Removed self-validating runtime contracts: `record_runtime_contract.py` now requires external browser-probe evidence and packages that evidence by hash.
- Added `probe_browser_runtime.mjs` and upgraded browser frame rendering to support DOM screenshots.
- Added `extract_alpha_components.py` for irregular image-model sheets where equal grid cells would clip limbs/props.
- Reworked despill to use fast Pillow channel operations and removed deprecated `getdata()` usage from that path.
- Added the first-class `raster-puppet` route with a deterministic part/pivot runtime builder.
- Added an optional HyperFrames exporter that produces a target-configured global runtime, `ficha.json`, `demo.html`, lossless WebP atlas and runtime README.
- HyperFrames sprite playback uses the selected target runtime's `porCuadro`; optional jump/reaction helpers use its `anim` helpers when available.
- Release-ready shared character packages now require their own `README.md` with runtime requirements.
- Expanded public documentation on what generated characters need after sharing and when to prefer sprites vs puppets/SVG/procedural characters.
- Added regression tests for global atlas scale/anchor, irregular extraction, non-self-validating runtime evidence, runtime view/expression/once semantics, and HyperFrames export.

## 1.1.0

- Renamed public skill to **Mafia AI Character Creator** / `mafia-ai-character-creator`.
- Made generated-art the default first-class route.
- Added canonical/model/action prompt templates.
- Added fake-transparency detection, chroma removal, generic despill, grid extraction, atlas composition, and automatic sprite-runtime generation.
- Changed generic required views from five to `front/q/side`; rear views are optional.
- Added optional Playwright frame renderer.
- Replaced same-order determinism check with forward/reverse/fresh-page evidence.
- Added hashed continuity, runtime-contract, determinism, and visual-review evidence to reject stale QA reports.
- Added action-vs-atlas structural checks for generated-art packages.
- Optimized foreground/difference work to avoid full Python pixel loops in common QA paths.
- Expanded the HyperFrames adapter using a verified global character namespace and seek-safe frame selection.
- Removed the private Mafia IA example profile from the public core.
- Added Codex, Claude Code, and generic hosted-skill installation guidance.
- Added explicit instruction to respond in the user's language.

## 1.0.0

- Initial generic character-creation adaptation.
