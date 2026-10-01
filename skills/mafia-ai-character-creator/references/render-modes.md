# Render modes

Mafia AI Character Creator supports several production routes behind the same character contract and QA process.

## 1. `generated-art` — community default

Use an image model or supplied raster art to create canonical views, expressions, and limited action frames. Deterministic scripts then clean the background, extract frames, normalize scale/anchor, build the atlas, generate the runtime, and validate it.

Best for:

- users who do not want to hand-code a renderer;
- idle/talking/pointing/small gesture animation;
- stylized art that is difficult to recreate procedurally.

Important: frame-by-frame AI art can drift. Large body motion should usually happen on the sprite container in the host animation system.

## 2. `raster-puppet` — generated art with articulated parts

Ask the image model for separate transparent parts: head, torso, upper/lower arms, hands, legs, feet, accessories, and expression pieces as needed. Follow `raster-puppet-workflow.md`: generate non-overlapping part sheets, extract the pieces, build a first-pass `assets/puppet.json` with `build_puppet_manifest.py`, visually correct pivots, then generate the runtime with `build_raster_puppet_renderer.py`.

Best for:

- recurring video characters;
- larger gestures without regenerating every frame;
- strong visual identity with GSAP/DOM-style acting;
- users who want generated art but more continuity than frame sprites.

This route is often the strongest compromise for programmatic video.

## 3. `rigged-svg`

Use SVG parts with explicit pivots and addressable face/body groups.

Best for:

- geometric or flat characters;
- exact resolution-independent art;
- direct GSAP animation;
- color/style variants.

## 4. `procedural-svg` / `procedural-canvas`

Draw the character from code as a pure function of state/time. Canvas can include hand-drawn boil, watercolor, ink, smears, squash/stretch, and procedural expression systems.

Best for:

- highly expressive cartoon acting;
- deliberate drawn turns/views;
- dynamic deformation;
- teams comfortable maintaining a renderer.

## Compatibility mode: `raster-sprites`

Use when an existing project already has a legacy sprite-atlas contract. New generic projects should normally use `generated-art` instead.

## Selection rule

Prefer `generated-art` for accessibility. Prefer `raster-puppet` when the character will recur and needs larger articulated motion. Prefer `rigged-svg` for geometric/vector-first characters. Prefer procedural modes when the drawing system itself is part of the look.
