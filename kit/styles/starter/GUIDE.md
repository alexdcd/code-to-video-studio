# Starter style

A neutral public foundation: no brand, no mascot, no fixed story. Neutral means **no identity**, not **no ambition**. A starter video must still look like motion design, never like a slide deck with a dark background.

Use it to learn the project contract or as scaffolding for a new identity. Do not treat it as the “Mafia AI look”.

## Direction

- dark field, sparse perspective grid, high-contrast type
- cyan primary accent, violet secondary
- cards/nodes for systems thinking
- one primary reading at a time, delivered with force: scale, camera and light, not a fade-in

## Ambition rules (default, not optional)

1. **The camera is always alive.** Every scene wraps its content in `.starter-camera` and calls `MAFIA.starter.camera(tl, el, { from, to, x, y, dur })` for a slow push-in or drift (6–12%) across the whole scene, plus one `MAFIA.starter.punch()` on the key beat.
2. **Contrast of scale.** The hero (title, number, node, object) fills at least 40% of the frame width or height; use `.starter-hero` for oversized numbers. Secondary elements are a third of that size or smaller.
3. **Three depth planes.** Grid/background, hero, foreground accent (glow, orbiting dots, connectors). They move at different speeds when the camera moves.
4. **Light.** Dark frames need a light source: the halo gradient, `.starter-glow`, a `.starter-beam`, or a `MAFIA.capas` flash on the key beat.
5. **Entrances are physical.** Blur-to-sharp and `y` travel for titles, `MAFIA.draw` for lines, `MAFIA.pop` for nodes, scale from 0.8 for heroes. No plain opacity fades on hero elements.
6. **Something always moves between beats.** Orbits rotate, dots pulse, the grid drifts. No frame stays fully static for more than 0.5 s.
7. **Cuts have impact.** Use `MAFIA.corte` or a zoom-through between scenes; avoid cross-fades.

## Do not

- center a title, a subtitle and one static shape and call it a scene
- fade everything in at the same speed
- add noise without a reading: particles, glitch and flashes are punctuation, not wallpaper

When a project develops a distinctive repeatable language, create a new style instead of endlessly modifying starter.
