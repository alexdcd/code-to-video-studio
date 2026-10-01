# Runtime requirements by character route

The **skill is an authoring tool**. A finished character should not require this skill, Python, Pillow, Playwright, or an image model at runtime unless the chosen target explicitly says so.

## `generated-art` (default sprite runtime)

Finished package needs:

- `character.json`
- `renderer/character.js`
- `assets/atlas.webp` or the image named by `assets/atlas.json`
- `assets/atlas.json`
- a modern browser with DOM/CSS and ES modules

The atlas stores one global scale and a common feet-center anchor. The renderer resolves `action + view + expression` and supports both looping and one-shot clips.

Serve the folder through HTTP during development. `file://` ES-module imports may be blocked by the browser.

No authoring dependencies are needed to play the final character.

## `raster-puppet`

Finished package needs:

- `character.json`
- `renderer/character.js`
- `assets/puppet.json`
- all transparent part images referenced by `puppet.json`
- a modern browser with DOM/CSS and ES modules

The runtime builds a hierarchy of image parts around explicit pivots. The host can animate those joints with its own timeline system. This route is often better than AI-generated frame-by-frame sprites for large gestures because identity is preserved while limbs move independently.

## `rigged-svg`

Finished package needs:

- the SVG or inline SVG renderer
- its JavaScript runtime
- whatever animation library the package declares, if any

Keep moving parts and pivots addressable. Avoid auto-traced monolithic paths when the character must act.

## `procedural-svg` / `procedural-canvas`

Finished package needs the generated renderer and any libraries it explicitly imports. Every visual state must be a deterministic function of time/state/seed.

Procedural canvas may require p5.js, p5.brush, or another drawing library if the package chooses them. Such dependencies must be documented in the character's own README.

## HyperFrames export

Run `scripts/generate_hyperframes_character.py character <package> --target <target-id> --project-root <repo>` on a generated-art or raster-puppet character. The selected target defines the character directory, asset URL prefix, and runtime global. The bundled Code to Video Studio target writes under `kit/characters/<slug>/`; other targets may choose their own layout.

Runtime requirements are target-specific. For the bundled target they are:

- the configured runtime global (`MAFIA`)
- GSAP
- the runtime's `porCuadro` helper
- its optional `anim` helper for jump/reaction acting

Both routes support `insertar(..., { ancho })`. The static display scale lives on an inner stage while wrapper acting lives on the outer container, so jump/squash does not overwrite the requested character size. The exported runtime uses the selected target's global namespace rather than ESM so the host kit builder can bundle it.

## Generated-art limitations

AI-generated frame sequences can drift in identity, proportions, and apparent scale. Use them mainly for limited animation such as idle, talking, blinking, pointing, or small gestures, often around 8–12 fps.

For larger motion such as entrances, jumps, impacts, camera-relative reactions, or travel across the scene, animate the sprite container with the host timeline (`MAFIA.anim`, GSAP, etc.) rather than asking the image model for every in-between frame.

When the character must make large articulated gestures while staying highly consistent, prefer `raster-puppet`, `rigged-svg`, or a procedural renderer.
