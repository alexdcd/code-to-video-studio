# Code to Video Studio — agent contract

This repository is a production system for programmatic video. Read this file before changing a video.

## Goal

Turn a brief into a clear, visually reviewed video. Make production controllable, repeatable and deterministic, and use the best-suited tool, model, skill or reusable resource for each job. Judge changes by whether they improve control and deliver better quality at lower cost. Do not optimize for clever code; optimize for what the viewer understands, in order.

## Workflow

1. Read the project's `BRIEF.md`.
2. Write or refine `SCRIPT.md`.
3. Write `STORYBOARD.md`: one primary event/change per scene, with visual readings in order.
4. Check the existing kit before creating a new primitive.
5. Build scenes in `compositions/`.
6. Run `pnpm run check <project>`.
7. Take snapshots at important poses/transitions.
8. Render with the root command. Renders are numbered and never overwrite prior versions; the command also creates a social copy and a VERSIONES.txt ledger. See docs/rendering.md, then create a contact sheet.
9. Only after visual review, consider the video finished.
10. If something is genuinely reusable, promote it into the kit rather than copy-pasting it into the next project.

## Project boundaries

- `kit/` is reusable infrastructure.
- `templates/` are starting points, not a visual identity.
- `proyectos/<name>/assets/kit/` is generated. Do not edit it.
- Project-specific art/code belongs in the project outside `assets/kit/`.
- A style, character or scene belongs in the kit only when it is reusable across different videos.

## Studio skills

- `skills/` is the canonical source for portable agent skills.
- `.claude/skills/`, `~/.claude/skills/` and `$CODEX_HOME/skills/` are installed destinations; do not edit duplicate copies.
- Use `pnpm run skills list|install|validate|package` to discover and distribute skills.
- Each skill's `DISTRIBUTION-MANIFEST.json` defines the exact files that may be installed or shared.

## Animation rules

Rendered video must be deterministic and seek-safe.

- Do not use unseeded `Math.random()`.
- Do not use `Date.now()` or `performance.now()` for rendered state.
- Do not accumulate physics/state frame by frame.
- Prefer state derived from time `t`.
- Use `MAFIA.rand(seed)` for randomness.
- Use `MAFIA.eachFrame()` / `MAFIA.porCuadro()` for state that must be recalculated while seeking.
- Avoid infinite GSAP repeats. Bound loops to the scene duration.
- If several `fromTo` tweens touch the same property, later ones should usually set `immediateRender: false`.
- Keep IDs unique in the fully assembled document.
- Do not apply CSS `transform` to an element GSAP also transforms.
- Use Rough.js only through `MAFIA.boceto` with an integer `semilla` ≥ 1; never call `rough.*` directly, use `fillStyle: "dots"` or `rough.newSeed()` (see `kit/lib/BOCETO.md`).
- Use physics only through `MAFIA.fisica`: it simulates once with a fixed step and is queried by time; never use `Matter.Runner` or `Engine.update` in a frame callback (see `kit/lib/FISICA.md`).
- A motion that looks correct in source code is not validated until key poses have been inspected.

## Direction rules

- One important reading at a time.
- Anticipate meaningful actions before they happen and leave enough time for the result to land.
- Prefer readable key poses first; add easing, arcs, squash/stretch and secondary motion second.
- Cause and reaction should not compete for attention at the exact same instant unless the effect is intentional.
- Text should explain only what the image cannot communicate efficiently.
- Keep the number of simultaneous moving elements purposeful.

## HyperFrames

Use the root-pinned HyperFrames version through the root scripts:

```bash
pnpm run dev my-video
pnpm run check my-video
pnpm run snapshot my-video --at 2.4
pnpm run render my-video
```

Do not add a second HyperFrames version inside individual projects.

## Reusable motion

Core helpers live in `kit/lib/`.

Useful APIs:

- `MAFIA.rand(seed)`
- `MAFIA.draw()`
- `MAFIA.pop()`
- `MAFIA.fade()`
- `MAFIA.eachFrame()`
- `MAFIA.anim.keyframes()`\n- `MAFIA.anim.curva()` — monotone seek-safe interpolation through measured keys
- `MAFIA.anim.spring()`
- `MAFIA.anim.arc()`
- `MAFIA.anim.pulse()`
- `MAFIA.anim.shake()`
- `MAFIA.anim.jump()`
- `MAFIA.anim.take()`

Read [docs/animation.md](docs/animation.md) before adding a new animation primitive.

## Visual review

Before finalizing:

- inspect the first frame
- inspect the main action pose of every scene
- inspect every transition boundary
- inspect the final frame
- render the whole piece
- create a contact sheet and look for dead time, clutter, unreadable text and accidental overlaps\n- run `pnpm run qa <video.mp4>` to flag long static sections, black frames, loudness, true peak and long silences

The code passing validation is necessary, not sufficient.
