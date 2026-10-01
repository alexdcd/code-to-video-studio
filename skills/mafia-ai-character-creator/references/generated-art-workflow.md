# Generated-art workflow

This is the default route for community users who want an image model to create the character art while deterministic code handles cleanup, normalization, playback, QA, and packaging.

## Identity order

1. Canonical reference / hero design.
2. Required view sheet grounded in that reference.
3. Expression sheet grounded in the same reference.
4. Limited action sheets grounded in the canonical reference and approved views.
5. Real-alpha cleanup.
6. Deterministic extraction.
7. Global-scale / feet-anchor atlas normalization.
8. Runtime generation.
9. Browser/runtime QA and visual review.

Never generate each action independently from text. Every later generation must use the approved canonical reference.

## Background strategy

Prefer a single flat chroma color that does not occur in the character. Saturated green such as `#00FF00` is a practical default only if the character itself contains no similar green.

Do not request a rendered checkerboard. A checkerboard printed into RGB pixels is not transparency.

```bash
python scripts/detect_fake_transparency.py raw.png
python scripts/remove_chroma_background.py raw.png --output clean.png --chroma-key '#00FF00'
python scripts/despill_chroma_edges.py clean.png --output clean-despilled.png --chroma-key '#00FF00'
```

Inspect fine hair, translucent materials, smoke, glows, and antialiasing manually; chroma workflows are not universally safe for them.

## Prompt templates

### Canonical design

```text
Create one canonical animation-character design for <NAME>.
Identity: <IDENTITY DESCRIPTION>.
Style: <STYLE>.
Keep a simple readable silhouette and construction that can stay consistent across many poses.
Show one neutral full-body hero pose on a completely flat <CHROMA> background.
No text, no scene, no decorative objects, no cast background texture, no fake transparency checkerboard.
Preserve exactly: <IDENTITY LOCKS>.
```

### Turnaround

```text
Using the supplied canonical character image as the identity source of truth, create a clean turnaround sheet of the SAME character.
Required views, left to right: <REQUIRED VIEWS>.
Optional views only if requested: <OPTIONAL VIEWS>.
Keep exactly the same proportions, face construction, palette, materials, markings, accessories, hand/foot construction, and line style.
Neutral pose in every view. Do not redesign between views.
Use a completely flat <CHROMA> background.
No labels, no scene, no checkerboard.
```

### Expressions

```text
Using the canonical character image, create an expression sheet of the SAME character.
Expressions: <EXPRESSIONS>.
Keep head shape, body proportions, palette, materials, and permanent markings unchanged.
Use a flat <CHROMA> background. No text or checkerboard.
```

### Limited action sheet

```text
Using the canonical character and approved turnaround as strict references, create one limited-animation sheet for: <ACTION>.
Produce <N> chronological key frames from anticipation through the readable action to settle.
Keep the character on-model, at the same apparent scale, with consistent ground level.
Props must physically contact the intended hand/anchor.
One action per sheet. Use the action name and description from references/motion-catalog.md.
Fewer, larger frames beat many small ones: 4-6 frames per image keep enough pixels per frame.
Use a completely flat <CHROMA> background. No text, scene, checkerboard, or gradient background.
```

## Extraction

Equal grids are acceptable only when the generated sheet really uses equal cells and nothing crosses a cell boundary:

```bash
python scripts/extract_grid.py clean-sheet.png --rows 2 --cols 4 --output-dir frames
```

When the image model lays poses out irregularly, use connected alpha components instead:

```bash
python scripts/extract_alpha_components.py clean-sheet.png \
  --output-dir frames \
  --names idle-0,idle-1,point-0,point-1
```

This avoids cutting off arms or props merely because the visual sheet is not a mathematically exact grid. The extractor clusters visual rows using component centres/vertical overlap and writes a labelled `_components-qa.png` contact sheet by default. Review that sheet before trusting supplied semantic names.

## Frame organization

The atlas builder accepts:

```text
frames/<action>/*.png
frames/<view>/<action>/*.png
frames/<view>/<expression>/<action>/*.png
```

The deepest form gives the runtime explicit view/expression/action variants.

## Atlas + runtime

```bash
python scripts/compose_sprite_atlas.py \
  --frames-root frames \
  --output character/assets/atlas.webp \
  --metadata character/assets/atlas.json \
  --once point,celebrate

python scripts/build_sprite_renderer.py character
```

The atlas builder uses one scale for every frame and aligns foreground bottom-center to one common anchor. It does **not** independently fit every frame into its cell.

The public default is **512×512 per atlas cell**, chosen for 1080p video rather than small UI sprites. For a protagonist that will appear around 700–900 px wide or in close-up, prefer `--cell-width 768 --cell-height 768` (or 1024) when the source art has enough detail. Increasing atlas cells cannot recover detail that is absent from the generated source. When normalization would upscale the largest source character above 1×, the builder emits a quality warning in stderr and `atlas.json`; treat that as a generation-quality signal, not as an error to hide. Fewer poses per generated sheet often gives each character more source pixels.

The runtime:

- resolves action, view, and expression;
- supports loop and one-shot clips;
- uses `actionTime`/`actionStart` for local timing;
- clamps one-shot actions at their last frame;
- resolves the atlas relative to the renderer module through `import.meta.url`.

## Important limitation

Image-model frame sequences can still drift in anatomy/proportions even after technical normalization. Prefer sprite sequences for limited animation. For larger movement, animate the whole container in the target host or choose `raster-puppet`, `rigged-svg`, or procedural rendering.
