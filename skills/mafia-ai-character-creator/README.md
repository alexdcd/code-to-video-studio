# Mafia AI Character Creator

**Mafia AI Character Creator** is a public, brand-neutral skill for turning a character idea, visual reference, or generated artwork into a reusable animated character package with deterministic runtime behavior and traceable visual QA.

The name is the project name; the skill does **not** assume Mafia IA branding. Anyone can use it for their own mascot, avatar, creature, robot, or recurring video character.

## What it creates

The skill can produce four main kinds of characters:

1. **Generated-art sprites** — easiest/default route. An image model makes the art; deterministic scripts build a normalized atlas and runtime.
2. **Raster puppet** — an image model makes separate body parts; the runtime rigs them around pivots so a host such as GSAP can articulate them.
3. **Rigged SVG** — vector parts with explicit pivots and addressable groups.
4. **Procedural SVG/Canvas** — the character is drawn from code as a pure function of state/time.

Legacy/custom sprite layouts remain supported through `raster-sprites`.

## Recommended route

For most community users, start with **generated-art**. It avoids hand-programming a renderer.

For a recurring character that must make larger gestures while staying very consistent, consider **raster-puppet**. AI-generated frame-by-frame sequences are best kept to limited animation such as idle, talking, blinking, pointing, or small reactions, often around 8–12 fps. Larger movement is better applied to the sprite/puppet container in the target animation system.

## Production pipeline

```text
reference / idea
    ↓
identity lock
    ↓
model + view + expression/action art
    ↓
real alpha / chroma cleanup
    ↓
robust frame or part extraction
    ↓
atlas or puppet rig
    ↓
deterministic runtime
    ↓
visual QA + runtime probe + seek-safety QA
    ↓
portable character package
```

The skill does not stop at “the image looks good.” A release-ready character must have reproducible assets, a declared runtime contract, QA evidence, and a README describing how to run it.

## Motion catalog

`references/motion-catalog.md` lists standard actions in five layers (presence, locomotion, communication, emotions, interaction), with route suitability and what the tooling supports today. Use `prepare_character_run.py --layer presence,communication` to start from a layer.

## Important fixes through v1.3.1

Generated-art atlases now use:

- **one global scale across every frame/action**;
- **feet-center anchoring** for every sprite cell;
- recorded anchor and normalization metadata in `atlas.json`;
- `view + expression + action` clip resolution;
- `loop` and `once` playback semantics;
- action-local time, so one-shot actions start at frame zero and clamp on the final frame;
- module-relative atlas URLs via `import.meta.url`.

The skill also adds irregular alpha-component extraction, external runtime-probe evidence, and a production-ready `raster-puppet` route. The default atlas cell is 512×512 for video, HyperFrames exports accept `ancho`, and the same exporter supports raster puppets. In v1.3.1, component extraction uses row clustering by visual centre/vertical overlap, always emits a labelled QA contact sheet by default, atlas upscaling emits an explicit quality warning, puppet `ancho` is based on visible character bounds instead of the authoring canvas, puppet runtimes expose `ciclo()`, and stale puppet manifests fail unless intentionally synchronized with `--sync-manifest`.

## What a generated character needs to work after you share it

The **skill is an authoring tool**. Someone using a finished character normally does **not** need this skill, Python, Pillow, Playwright, or an image model.

### Generated-art character

Keep these files together:

```text
character/
├── README.md
├── character.json
├── demo.html
├── renderer/
│   └── character.js
└── assets/
    ├── atlas.webp   # or the image named by atlas.json
    └── atlas.json
```

Runtime needs:

- a modern browser;
- JavaScript ES modules;
- DOM/CSS.

Serve the folder over HTTP during development because some browsers restrict ES modules from `file://`.

### Raster-puppet character

Keep:

```text
character/
├── README.md
├── character.json
├── renderer/character.js
└── assets/
    ├── puppet.json
    └── parts/
        ├── head.webp
        ├── torso.webp
        └── ...
```

Runtime needs a modern browser with DOM/CSS/ES modules. The target animation system may then animate the part joints. The authoring workflow and part-sheet prompts are in `references/raster-puppet-workflow.md`.

### HyperFrames export

The optional HyperFrames adapter exports generated-art or raster-puppet packages according to a target configuration. The bundled `code-to-video-studio` target writes to `kit/characters/` and uses `assets/kit/characters/` for runtime URLs:

```bash
python scripts/generate_hyperframes_character.py character \
  /path/to/character \
  --target code-to-video-studio \
  --project-root .
```

Generated-art output:

```text
kit/characters/<slug>/
├── <slug>.js
├── atlas.webp
├── atlas.json
├── ficha.json
├── demo.html
└── README.md
```

Raster-puppet output uses `puppet.json` and `parts/` instead of an atlas. Both routes expose `insertar(..., { ancho })`; puppet width uses visible content bounds, not the authoring canvas. The target runtime, output path, asset prefix, and optional finalization commands come from the selected target JSON. See [`adapters/hyperframes.md`](adapters/hyperframes.md).

## Installation

Install/copy the **entire skill directory or ZIP**, not just `SKILL.md`. The supporting Python scripts, references, schemas, templates, adapters, and tests are part of the skill.

### Codex

```text
${CODEX_HOME:-$HOME/.codex}/skills/mafia-ai-character-creator/
```

### Claude Code

```text
~/.claude/skills/mafia-ai-character-creator/
```

### Claude.ai / other compatible skill hosts

Upload or install the whole folder/ZIP if the product supports custom skills. Product/UI availability may vary.

## Authoring dependencies

Core deterministic tooling:

```bash
python -m pip install -r requirements.txt
```

Development/tests:

```bash
python -m pip install -r requirements-dev.txt
```

Optional browser QA/probing:

```bash
pnpm install --prefix browser-tools
```

Image generation is provider-neutral. The host can use its native image model, another image tool, or art supplied by the user.

## Main generated-art commands

Clean and extract:

```bash
python scripts/detect_fake_transparency.py raw.png
python scripts/remove_chroma_background.py raw.png --output clean.png --chroma-key '#00FF00'
python scripts/despill_chroma_edges.py clean.png --output clean-despilled.png --chroma-key '#00FF00'
```

For regular grids:

```bash
python scripts/extract_grid.py clean.png --rows 2 --cols 4 --output-dir frames
```

For irregular layouts, prefer alpha components:

```bash
python scripts/extract_alpha_components.py clean.png \
  --output-dir frames \
  --names idle-0,idle-1,point-0,point-1
```

The extractor groups components into visual rows using vertical centres/overlap rather than top-edge order and writes `_components-qa.png` by default. **Open that labelled contact sheet before continuing.** The tool cannot infer whether a crop is really `foot-left` or `lower-leg-left`; the QA sheet exists to catch semantic mislabelling before it enters a rig.

Build a stable atlas and runtime:

```bash
python scripts/compose_sprite_atlas.py \
  --frames-root frames \
  --output character/assets/atlas.webp \
  --metadata character/assets/atlas.json \
  --once point,celebrate

python scripts/build_sprite_renderer.py character
```

If the global normalization scale is greater than 1×, `compose_sprite_atlas.py` now writes a `qualityWarnings` entry and prints a warning to stderr. Upscaling a 300 px character into a 512 px cell does **not** create detail; generate fewer poses per sheet or request a larger source image when final display size matters.

## Raster-puppet authoring

Read `references/raster-puppet-workflow.md`. After generating/cleaning a non-overlapping part sheet and extracting the pieces:

```bash
python scripts/build_puppet_manifest.py \
  --parts-dir character/assets/parts \
  --output character/assets/puppet.json \
  --archetype humanoid \
  --canvas 1024x1024

python scripts/build_raster_puppet_renderer.py character
```

`build_puppet_manifest.py` proposes hierarchy and pivots from semantic part names, but deliberately marks them as a draft requiring visual pivot QA. For non-humanoid anatomy use `--archetype free`. Humanoid drafts also include `walk-a` / `walk-b`; target adapters may use them with a `ciclo()` helper for a real repeating walk rather than treating `walk` as a single frozen pose.

If `character.json` declares views/actions that are not actually present in `puppet.json`, standalone build and HyperFrames export now fail instead of silently falling back. When that mismatch is intentional, pass `--sync-manifest` to align the manifest to the capabilities that really exist.


## Runtime / determinism QA

The runtime contract can no longer validate itself. Probe the real browser runtime first:

```bash
pnpm install --prefix browser-tools
python -m http.server 8000 --directory character

node scripts/probe_browser_runtime.mjs \
  --url=http://localhost:8000/demo.html \
  --manifest=character/character.json \
  --out=character/qa/runtime-probe.json

python scripts/record_runtime_contract.py \
  --package character \
  --evidence character/qa/runtime-probe.json
```

Seek safety should be checked with forward, reverse, and fresh-page renders, then compared with `validate_determinism.py`.

## Validate this skill

```bash
python scripts/validate_skill.py .
pytest -q
```

## Validate/package a finished character

```bash
python scripts/validate_character_package.py character --require-qa
python scripts/package_character.py character --output character.zip --require-qa
```

Release validation checks portability, runtime claims, atlas/puppet structure, view/action QA, determinism evidence, visual-review hashes, and the presence of a runtime README.

## License / upstream work

This package is a substantial adaptation of the user-supplied Apache-2.0 `hatch-pet` skill. Animation-system ideas were also informed by MIT-licensed [`JohnHeibel/ClaudeAnimationBase`](https://github.com/JohnHeibel/ClaudeAnimationBase). See `NOTICE.md`, `THIRD_PARTY_NOTICES.md`, and `references/upstream-map.md`.
