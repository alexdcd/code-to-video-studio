# Raster-puppet workflow

Use this route when generated art should keep its visual identity but the character needs larger, smoother gestures than frame-by-frame AI sprites can reliably provide.

The finished character is a hierarchy of transparent image parts with explicit pivots. A runtime or host timeline rotates/translates those parts instead of regenerating every in-between frame.

## Recommended production order

1. Lock one canonical character image.
2. Generate one **part sheet per required view** from that canonical image.
3. Clean the flat background to real alpha.
4. Extract each non-overlapping part without resizing it.
5. Name the parts consistently.
6. Build a first-pass `puppet.json` with `build_puppet_manifest.py`.
7. Render/test joint pivots under motion and correct them.
8. Add real named poses/actions.
9. Generate the standalone runtime or a target adapter such as HyperFrames.
10. Run runtime, determinism, and visual QA before release.

## Part-sheet prompt

Use the canonical character image as an image reference/source of truth.

```text
Create a production part sheet for the SAME animation character shown in the supplied canonical reference.
View: <front | q | side>.

Separate the character into these independent pieces, all shown at the SAME relative scale they have on the assembled character:
<PART LIST>

Typical humanoid list:
- head
- torso
- upper-arm-left
- forearm-left
- hand-left
- upper-arm-right
- forearm-right
- hand-right
- upper-leg-left
- lower-leg-left
- foot-left
- upper-leg-right
- lower-leg-right
- foot-right
- fixed accessories that must move independently

Requirements:
- preserve the exact identity, palette, proportions, line style and materials of the canonical reference;
- every piece must be fully visible and must NOT overlap any other piece;
- leave generous flat background space between pieces;
- do not resize body parts independently for presentation;
- keep each piece in a neutral undeformed state;
- no labels, arrows, shadows, scene, text, checkerboard or decorative elements;
- use one completely flat <CHROMA> background that does not occur in the character;
- preserve clean attachment edges at shoulders, elbows, wrists, hips, knees and ankles.
```

For simple characters, whole arms/legs are valid and often more robust than splitting every joint.

## Expression-variant prompt

Prefer changing only the smallest necessary part, usually the head/face.

```text
Using the SAME canonical character and the approved <VIEW> head as strict reference, create separated variants of ONLY the head for these expressions:
<EXPRESSIONS>

Keep head size, angle, crop, palette, permanent markings and line style identical. Only expression-specific features may change. Place every variant separately, without overlap, at the same scale, on a flat <CHROMA> background. No labels or text.
```

After extraction, name variants using a double dash:

```text
head.png
head--happy.png
head--surprised.png
```

## Face layers (talk, blink, emotions)

For `talk`, `blink` and emotions, request `eyes`, `brows` and `mouth` as separate pieces, plus variants such as `mouth--open`, `mouth--closed`, `eyes--happy`. `build_puppet_manifest.py` makes them children of `head` and gives them a first-guess position; extraction crops lose where each piece sat on the head, so correct their `x`/`y` in `puppet.json` after looking at a render. See `references/motion-catalog.md` for a seek-safe talk snippet.

Files whose names start with `_` (such as `_components-qa.png`) are QA output and are never treated as parts or frames.

## Folder convention

Recommended:

```text
character/assets/parts/
├── front/
│   ├── torso.png
│   ├── head.png
│   ├── head--happy.png
│   ├── upper-arm-left.png
│   └── ...
├── q/
│   └── ...
└── side/
    └── ...
```

Do not rescale individual crops after extraction. Their relative pixel sizes are useful evidence for first-pass rig placement.

## Clean and extract

```bash
python scripts/remove_chroma_background.py raw-front.png \
  --output clean-front.png \
  --chroma-key '#00FF00'

python scripts/despill_chroma_edges.py clean-front.png \
  --output clean-front-despilled.png \
  --chroma-key '#00FF00'

python scripts/extract_alpha_components.py clean-front-despilled.png \
  --output-dir character/assets/parts/front \
  --names torso,head,upper-arm-left,forearm-left,hand-left,upper-arm-right,forearm-right,hand-right,upper-leg-left,lower-leg-left,foot-left,upper-leg-right,lower-leg-right,foot-right
```

The extractor clusters a visual row by component centre/vertical overlap, then sorts left-to-right. This is more robust than top-edge sorting when a head, arm and foot have different heights but are visually centred on the same row. It also writes `character/assets/parts/front/_components-qa.png` by default. **Open this labelled contact sheet before building `puppet.json`.** Names come from the order you supplied; pixels cannot tell the tool that a shape is actually `foot-left` rather than `lower-leg-left`. If any label is wrong, rename/move the crops explicitly before continuing.

## Build a first-pass rig

For a standard humanoid:

```bash
python scripts/build_puppet_manifest.py \
  --parts-dir character/assets/parts \
  --output character/assets/puppet.json \
  --archetype humanoid \
  --canvas 1024x1024
```

The builder:

- detects views from subdirectories;
- groups `part--expression` variants;
- proposes parent hierarchy;
- proposes pivots based on semantic part names;
- proposes root/ground anchor;
- can add rough common pose targets such as point/walk/think when matching parts exist;
- marks the result as a layout draft that requires visual pivot QA.

For non-humanoid or unusual anatomy, use `--archetype free` and author hierarchy/pivots deliberately.

**Do not treat heuristic pivots as final.** Generated art has arbitrary attachment geometry. Rotate shoulders, elbows, hips and knees through extreme poses and correct pivots until joints stay attached.

## Build standalone runtime

```bash
python scripts/build_raster_puppet_renderer.py character
```

## Export to HyperFrames

The configured exporter handles raster puppets:

```bash
python scripts/generate_hyperframes_character.py character \
  /path/to/character \
  --target code-to-video-studio \
  --project-root .
```

The runtime API provides:

- `insertar(..., { ancho })` — `ancho` means visible neutral character width in the default view, not authoring-canvas width
- `posar()`
- `animar()` — seek-safe interpolation between named poses through the configured runtime's `porCuadro` helper
- `accion()`
- `ciclo()` — cyclic interpolation across two or more named poses, useful for `walk-a` / `walk-b`
- `entrar()`
- `saltar()` / `reaccionar()` using the configured runtime's `anim` helpers when available

Use puppet joint poses for articulation and the host runtime's motion helpers/GSAP for larger movement such as jumping, impacts or travelling across the scene.

The exporter validates `character.json` against the real puppet views/actions. It fails on stale declarations instead of silently falling back. Pass `--sync-manifest` only when you intentionally want to rewrite the character manifest to the puppet capabilities that actually exist.
