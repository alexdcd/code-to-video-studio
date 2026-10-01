---
name: mafia-ai-character-creator
description: Create, animate, validate, visually QA, repair, and package reusable characters from text, references, or generated art. Use for mascots, recurring characters, avatars, creatures, robots, or stylized people that must stay on-model across views/actions and work in real animation projects. Generated-art is the default route; raster-puppet, rigged SVG, procedural SVG/Canvas, and legacy sprite workflows are supported alternatives.
---

# Mafia AI Character Creator

## Purpose

Turn a character idea or visual reference into a **production-ready, shareable animated character package**, not just an attractive image.

The skill is public and generic despite its name. Do not assume Mafia IA branding, a private repo, HyperFrames, Codex, Claude, a particular image provider, or a particular runtime unless the user/project explicitly selects them.

**Respond in the user's language unless they ask for another language.**

A completed character should be:

- visually consistent across required views/actions;
- controllable through semantic state/actions;
- deterministic and seek-safe;
- portable within its declared target;
- inspectable through generated QA evidence;
- accompanied by a runtime README so another person can actually use it;
- repairable without regenerating unrelated passing work.

## Core rule

**Do not stop when the character looks good. Stop when the character can act, can be rendered repeatedly, can be shared, and passes traceable QA.**

# Choose the render route

Read `references/render-modes.md` and `references/runtime-requirements.md` before implementation. Read `references/motion-catalog.md` before deciding which actions to build. For raster puppets, also read `references/raster-puppet-workflow.md`.

## Route A — `generated-art` (default)

Use an image model or supplied raster art for the visual identity, then deterministic scripts for:

```text
canonical reference
→ views / expressions / limited action sheets
→ real alpha cleanup
→ robust extraction
→ one global atlas scale + feet-center anchor
→ generated browser runtime
→ runtime probe + visual QA + determinism QA
→ portable package
```

Use this by default for community users who should not have to hand-code a renderer.

Generated sprite sequences are best for limited animation, typically around 8–12 fps: idle, talk, blink, point, small reactions. For big travel/jumps/impacts, animate the whole sprite container in the target host.

## Route B — `raster-puppet`

Use generated/supplied transparent body parts rather than regenerated animation frames:

```text
head / torso / arms / hands / legs / props
→ explicit pivots + hierarchy
→ generated part runtime
→ host timeline animates joints
```

Prefer this for recurring video characters that need larger articulated gestures while preserving identity.

## Route C — `rigged-svg`

Use vector pieces with explicit pivots and addressable groups. Best for geometric/flat characters and precise GSAP-style animation.

## Route D — `procedural-svg` / `procedural-canvas`

Draw the character from code as a deterministic function of state/time/seed. Best for hand-drawn boil, ink/watercolor, smears, squash/stretch, or highly expressive cartoon systems.

## Compatibility — `raster-sprites`

Use only when an existing target already has a different sprite-atlas contract. New generic packages should usually use `generated-art`.

# Inputs

Accept any combination of:

- text description;
- one or more reference images;
- existing character art;
- SVG/rig;
- model sheet;
- brand/style cues;
- required actions, expressions, props, or views;
- target repo/runtime.

When a reference exists, treat it as the identity source of truth unless the user explicitly requests redesign.

If no reference exists, establish one canonical design before generating multiple views/actions. Never invent each pose independently from text.

# Identity lock

Before action generation or renderer implementation, write down:

- silhouette/proportions;
- head/face construction;
- eyes/mouth rules;
- limb/hand/foot construction;
- palette/material/line style;
- asymmetries/markings;
- fixed accessories;
- allowed acting deformation;
- forbidden drift.

Resolve conflicting references before proceeding.

# Views

Read `references/view-system.md`.

Generic release gate:

```text
front, q, side
```

Optional when actually needed:

```text
qback, back
```

Use `character.json.requiredViews` as the release gate. Do not force five views if three are sufficient.

# Determinism contract

Visual state at time `t` must depend only on explicit inputs such as time, action/state, options, and stable seed.

Avoid uncontrolled:

```text
Math.random()
Date.now()
performance.now()
setInterval()
sequential counters that require previous frames
```

Seek safety must survive:

1. forward-order rendering;
2. reverse-order rendering in the same page;
3. fresh-page rendering for each sampled time.

Same-order rerendering alone is not evidence of seek safety.

# Public/shared-package rules

- Keep the core generic.
- Project-specific behavior belongs in adapters.
- Keep final package paths relative.
- Never package secrets, API keys, temporary generation URLs, or machine-specific authoring paths.
- Do not package third-party character art without permission.
- Preserve upstream license/notice requirements.
- A `ready` package must contain a runtime `README.md` explaining exactly what files/libraries are needed to play the character.

# Authoring dependencies

Core:

- Python 3.10+
- Pillow

Tests:

- pytest

Optional browser/runtime QA:

- Node.js
- Playwright from `browser-tools/package.json`

Image generation is provider-neutral. Use the host's image capability or user-supplied art.

# Workflow

## 1. Prepare the run

```bash
python scripts/prepare_character_run.py \
  --name "My Character" \
  --reference /path/reference.png \
  --notes "minimal geometric mascot" \
  --profile profiles/generic.json \
  --output-dir /path/run
```

`--render-mode auto` defaults to `generated-art` unless the request clearly calls for procedural/rigged/puppet behavior.

### Choose actions from the motion catalog

Do not invent action names or build everything. Read `references/motion-catalog.md`, pick the layers the video needs, and add them at preparation time:

```bash
python scripts/prepare_character_run.py \
  --name "My Character" \
  --profile profiles/generic.json \
  --layer presence,communication \
  --output-dir /path/run
```

Layers: `presence` (idle, blink), `locomotion`, `communication` (talk, nod, point, present...), `emotions`, `interaction`. Build layer 1 first; add the rest later without redoing what passed QA.

Rules that follow from the catalog:

- Use the catalog names (`talk`, `point`, `joy`...) so scenes can address any character the same way.
- Check each action's Sprites/Puppet suitability. Do not generate `avoid` actions as AI sprite sequences; use `raster-puppet` or animate the container instead.
- Keep what changes in its own layer (`eyes`, `brows`, `mouth`, hands) instead of regenerating whole sheets.
- Say plainly which actions are `manual` or `planned` in the tooling; do not claim them as supported in `character.json` until a probe shows them working.

## 2. Lock identity

Complete the generated brief before producing downstream views/actions.

## 3A. Generated-art route

Read `references/generated-art-workflow.md` and use its prompt templates.

Recommended order:

1. canonical design;
2. required turnaround;
3. expressions;
4. one limited-action sheet per required action.

Every later image must be grounded in the canonical reference and approved views.

Prefer a flat chroma background not used by the character. Never request a checkerboard as fake transparency.

### Clean alpha

```bash
python scripts/detect_fake_transparency.py raw.png
python scripts/remove_chroma_background.py raw.png \
  --output clean.png \
  --chroma-key '#00FF00'
python scripts/despill_chroma_edges.py clean.png \
  --output clean-despilled.png \
  --chroma-key '#00FF00'
```

Inspect translucent/fine details manually.

### Extract frames

Use equal-grid extraction only for genuinely regular grids:

```bash
python scripts/extract_grid.py clean-sheet.png \
  --rows 2 --cols 4 \
  --output-dir frames
```

For typical image-model layouts where spacing/cells are irregular, prefer:

```bash
python scripts/extract_alpha_components.py clean-sheet.png \
  --output-dir frames \
  --names idle-0,idle-1,point-0,point-1
```

The component extractor groups a visual row by centre/vertical overlap, then left-to-right, and writes `_components-qa.png` by default. **Open that labelled QA sheet before trusting semantic names.** The extractor can order shapes, but it cannot know whether a crop is really `foot-left` or `lower-leg-left`. Fix any label mismatch before atlas/rig generation.

For a single strip:

```bash
python scripts/extract_motion_strip.py walk-strip.png \
  --frames 8 \
  --output-dir frames/walk
```

Do not use image generation for deterministic slicing.

### Organize variants

The atlas builder supports:

```text
frames/<action>/*.png
frames/<view>/<action>/*.png
frames/<view>/<expression>/<action>/*.png
```

Prefer the third layout when views and expressions must be addressable at runtime.

### Build stable atlas

```bash
python scripts/compose_sprite_atlas.py \
  --frames-root frames \
  --output character/assets/atlas.webp \
  --metadata character/assets/atlas.json \
  --once point,celebrate

# defaults to 512×512 cells for video; use 768–1024 for close-up protagonists when source art supports it
```

The builder must:

- compute **one scale for the whole atlas**;
- align every frame to a common **feet-center anchor**;
- record scale, anchor, source bbox, and normalized subject box in `atlas.json`;
- warn when global normalization scale is greater than 1× because larger atlas cells cannot create missing source detail;
- never independently fit each frame to its cell.

### Generate standalone runtime

```bash
python scripts/build_sprite_renderer.py character
```

The runtime must:

- resolve `action + view + expression`;
- support `loop` and `once` clips;
- use `actionTime` or `actionStart` for action-local timing;
- clamp one-shot clips on their final frame;
- resolve the atlas relative to the JS module with `import.meta.url`;
- create `demo.html` and a runtime README.

Do not silently reduce manifest claims unless the user explicitly accepts `--sync-manifest`.

## 3B. Raster-puppet route

Read `references/raster-puppet-workflow.md`. Generate/supply transparent parts with consistent style/scale. Prefer the minimum articulation the character actually needs; whole arms/legs are often more stable than unnecessary joint splits.

Recommended authoring layout:

```text
character/assets/parts/
├── front/
├── q/
└── side/
```

Use `part--expression.png` for expression-specific variants such as `head--happy.png`.

Build a first-pass rig from the cropped parts:

```bash
python scripts/build_puppet_manifest.py \
  --parts-dir character/assets/parts \
  --output character/assets/puppet.json \
  --archetype humanoid \
  --canvas 1024x1024
```

The generated hierarchy/pivots are a draft, not ground truth. Visually rotate the actual joints and correct attachment points before release. For unusual anatomy use `--archetype free` and author the rig deliberately. Humanoid drafts include `walk-a` / `walk-b` when matching limbs exist so adapters can build an actual repeating cycle rather than freezing one `walk` pose.

Then build the standalone runtime:

```bash
python scripts/build_raster_puppet_renderer.py character
```

If `character.json` is stale and claims puppet views/actions that do not exist, fail rather than silently falling back. Only when the mismatch is intentional, rerun with `--sync-manifest` to align manifest claims to the real puppet capabilities.

For HyperFrames the same public exporter supports puppet packages:

```bash
python scripts/generate_hyperframes_character.py character \
  /path/to/character \
  --target code-to-video-studio \
  --project-root .
```

The HyperFrames puppet runtime exposes `insertar({ ancho })`, `posar`, seek-safe `animar`/`accion`, `ciclo()` for repeated pose cycles, and wrapper-level `entrar`, `saltar`, `reaccionar`. For puppet exports, `ancho` means the visible neutral character width in the default view, derived from `contentBounds`, not the authoring canvas width.

Do not call this route release-ready until hand/limb pivots have been visually checked under real motion.

## 3C. Rigged SVG

- separate true moving parts;
- define pivots explicitly;
- keep face pieces addressable;
- avoid monolithic auto-traced SVGs;
- test extreme poses, not just neutral.

## 3D. Procedural renderer

- each visual state must be calculable from `t/state/seed`;
- views are deliberate key drawings/constructions, not accidental 3D rotation unless the style explicitly requires 3D;
- seed each independently boiling/jittering part so motion in one element does not re-randomize unrelated elements;
- render contact sheets and motion strips during implementation.

# Semantic runtime state

Where relevant, support concepts such as:

```text
view
flip
expression
action
actionTime / actionStart
lookX / lookY
walk/gait phase
armL / armR
squash/stretch
rotation
propL / propR
seed
```

Generic ESM entrypoints are normally:

```text
renderCharacter
getCharacterCapabilities
```

Record actual symbols in `character.json.api`.

# Browser runtime evidence

The runtime contract must not copy claims from the manifest and call that evidence.

Start the standalone package over HTTP, then probe the actual runtime:

```bash
python -m http.server 8000 --directory character

node scripts/probe_browser_runtime.mjs \
  --url=http://localhost:8000/demo.html \
  --manifest=character/character.json \
  --out=character/qa/runtime-probe.json

python scripts/record_runtime_contract.py \
  --package character \
  --evidence character/qa/runtime-probe.json
```

The probe must exercise declared views/actions/expressions and the final runtime contract must hash both renderer and evidence.

# Determinism QA

Use `render_browser_frames.mjs` or a native target snapshot tool to render the same requested times/states in:

```text
qa/determinism/forward/
qa/determinism/reverse/
qa/determinism/fresh/
```

Then:

```bash
python scripts/validate_determinism.py \
  --forward character/qa/determinism/forward \
  --reverse character/qa/determinism/reverse \
  --fresh character/qa/determinism/fresh \
  --json-out character/qa/determinism.json
```

# Visual QA

Read `references/qa-rubric.md`.

Generate/review:

- required views;
- expressions;
- every required action;
- hand/prop contacts;
- clipping/matte edges;
- motion timing/readability;
- any face/hand/foot closeups needed.

Commands:

```bash
python scripts/make_view_qa_sheet.py \
  --views-dir character/qa/frames/views \
  --views front,q,side \
  --output character/qa/views.png

python scripts/measure_view_continuity.py \
  --views-dir character/qa/frames/views \
  --views front,q,side \
  --json-out character/qa/view-continuity.json

python scripts/render_animation_previews.py \
  --frames-root character/qa/frames/actions \
  --output-dir character/qa/previews \
  --fps 12

python scripts/make_contact_sheet.py \
  --input-dir character/qa/frames \
  --output character/qa/contact-sheet.png \
  --recursive
```

After actual visual review:

```bash
python scripts/record_visual_review.py \
  --package character \
  --reviewer "<reviewer>" \
  --verdict pass \
  --note "Reviewed views, contacts and all action previews."
```

The report hashes the exact reviewed files. Any later change invalidates the review.

# HyperFrames export

This is an optional adapter, not part of the generic core. It reads a target configuration for the character directory, asset URL prefix, runtime global, and optional build/version policy.

For the bundled Code to Video Studio target:

```bash
python scripts/generate_hyperframes_character.py character \
  /path/to/character \
  --target code-to-video-studio \
  --project-root .
```

The output lives under `kit/characters/<slug>/` and includes a non-ESM runtime, `ficha.json`, demo, README, and either an atlas or the puppet parts. The runtime namespace comes from the selected target configuration. Raster-puppet exports validate declared capabilities against the real puppet; use `--sync-manifest` only when intentionally reconciling stale declarations. Read `adapters/hyperframes.md` before integration.

# Repair policy

Classify the failure before modifying assets:

- identity drift;
- wrong view semantics;
- wrong scale/ground anchor;
- chroma/matte contamination;
- extraction/cropping error;
- runtime clip/timing bug;
- pivot/hierarchy bug;
- prop contact;
- renderer determinism;
- stale QA evidence.

Repair the smallest root cause. Do not regenerate passing views/actions merely because one asset failed.

For generated art, if only one pose drifts, regenerate that pose grounded in the canonical reference rather than replacing the entire sheet unless the sheet itself is the root cause.

# Release gate

A public character is ready only when:

- `character.json.status == "ready"`;
- runtime entry exists and is not a stub;
- character README explains runtime requirements;
- required views exist;
- every declared action has QA preview evidence;
- generated-art atlas has schema v2, global scale and feet-center anchor;
- declared views/actions/expressions are structurally present in atlas/puppet data;
- runtime probe confirms declared capabilities;
- forward/reverse/fresh determinism evidence passes;
- visual review passes against current artifact hashes;
- package contains no secrets or machine-local paths.

Validate:

```bash
python scripts/validate_character_package.py character --require-qa
```

Package reproducibly:

```bash
python scripts/package_character.py character \
  --output character.zip \
  --require-qa
```

# Skill self-validation

Before sharing a new skill release:

```bash
python scripts/validate_skill.py .
pytest -q
```

Do not report a release as passing unless both complete successfully.
