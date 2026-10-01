# Motion catalog

A menu of standard actions for animated characters, organized in layers. Pick the layers a project needs; do not generate everything.

Why it exists:

- **Shared names.** A scene asks for `talk` or `point` and any character package built with this skill answers to it.
- **Base once, extras later.** Build layer 1 first; add specific actions later without redoing what already passed QA.
- **Honest scoping.** Each action says which route can do it well, so nobody spends hours generating "sit down" as AI sprites and getting identity drift.

Profiles expose these layers through `actionLayers` (see `profiles/generic.json`). Use them with:

```bash
python scripts/prepare_character_run.py --name "My Character" --layer presence,communication --output-dir /path/run
```

`--layer` adds the layer's actions to the request. `--action` adds individual ones. Both can be combined.

## How to read the tables

- **Kind:** `loop` repeats; `once` plays and holds its last frame; `state` is a value (look direction, expression), not a clip.
- **Sprites / Puppet:** how suitable the route is. `good` = expected to work; `limited` = works with visible compromises; `avoid` = plan another route or animate the container instead.
- **Tooling today:** what this skill provides right now. `yes` = generated runtime supports it; `manual` = possible, but you author it (pose, snippet or timeline code); `planned` = not implemented yet.

Suitability ratings are guidance from the known limits of image models (identity and scale drift between frames), not measured results. Check them visually in QA.

## Layer 1 — Presence (always on)

Recommended for every character. Cheap, and it is what stops a character from looking like a still image.

| Action | Kind | Typical length | Sprites | Puppet | Tooling today | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `idle` | loop | 2–4 s | good | good | yes | Breathing, weight shifts. Keep amplitude low; it plays under everything else. |
| `blink` | once | 0.15–0.25 s | good | good | manual | Swap eyes/head variant for 2–3 frames. Trigger at seeded intervals, never with random. |
| `look` | state | — | limited | good | manual | Use `lookX`/`lookY` (eyes or head part). 16-direction sprite sets are expensive and drift; prefer eye layers. |

## Layer 2 — Locomotion

| Action | Kind | Typical length | Sprites | Puppet | Tooling today | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `walk` | loop | 0.8–1.2 s per cycle | limited | good | yes (puppet `ciclo` with `walk-a`/`walk-b`) | Left and right by `flip`; check handedness and props. |
| `run` | loop | 0.5–0.8 s per cycle | limited | limited | manual | Same as `walk` with larger poses; add container travel in the host. |
| `turn` | once | 0.3–0.6 s | good | good | manual | Step between key views `front → q → side`; do not fake it by skewing one drawing. |
| `start` / `stop` | once | 0.2–0.4 s | limited | good | manual | Anticipation before moving, settle after stopping. |
| `jump` | once | 0.6–1.0 s | avoid | good | yes (container `saltar` with host motion helpers) | Airtime as sprites drifts; do it on the container with squash and arc. |

## Layer 3 — Communication (most used in video)

| Action | Kind | Typical length | Sprites | Puppet | Tooling today | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `talk` | loop | any | good | good | manual (snippet below) | Mouth open/closed plus slight head bob. It is the action explainers ask for most. |
| `nod` / `shake` | once | 0.4–0.8 s | good | good | manual | Head rotation with a small overshoot. Puppet: rotate the `head` joint. |
| `point` | once | 0.4–0.7 s | good | good | yes (draft pose in the humanoid puppet) | Arm toward an object or the camera. Hold long enough to read. |
| `present` | once | 0.5–0.8 s | good | good | manual | Open hand toward something or the audience. |
| `wave` | loop/once | 0.8–1.5 s | good | good | manual | Hand and forearm swing. |
| `shrug` | once | 0.5–0.8 s | good | good | manual | Shoulders up, hands out, slight head tilt. |
| `think` | loop | 1–2 s | good | good | yes (draft pose in the humanoid puppet) | Hand to chin or head; avoid competing movement. |

## Layer 4 — Emotions

Emotions live in the body as much as in the face. Do not implement them only as an eyes/brows swap.

| Action | Kind | Typical length | Sprites | Puppet | Tooling today | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `surprised` | once | 0.4–0.8 s | good | good | manual | Anticipation, recoil, hold. Container `reaccionar` helps. |
| `joy` (alias `celebrate`) | loop/once | 0.8–1.5 s | limited | good | yes (draft pose `celebrate`) | Arms up. |
| `angry` | loop | 1–2 s | limited | good | manual | Frustration reads through posture and shake. |
| `sad` | loop | 1–2 s | good | good | manual | Slumped shoulders, lowered head. |

Expressions (face only, `neutral`, `happy`, ...) are a separate axis: they combine with any action through the `expression` state.

## Layer 5 — Interaction with the world

The hardest layer. Needs hand anchors, contact and physical plausibility. Add only what a video actually needs.

| Action | Kind | Typical length | Sprites | Puppet | Tooling today | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `grab` / `hold` / `release` | once / loop / once | 0.3–0.6 s each | avoid | limited | planned | Needs a hand anchor per frame or joint. Today, attach the prop to the hand joint in the host. |
| `push` / `pull` | loop | 0.8–1.2 s | avoid | limited | manual | Contact with the object is the real problem; check it in QA. |
| `sit` / `stand` | once | 0.6–1.0 s | avoid | limited | manual | Needs a separate seated rig or view. Plan for it up front. |
| `fall` / `hit` | once | 0.4–0.8 s | limited | good | yes (container `reaccionar`) | Good for humor and transitions. |

## Independent layers (so you do not regenerate everything)

Regenerating a whole action sheet to change one thing loses identity. Split what changes:

- **Body, head, eyes, brows, mouth, hands as separate parts.** In the `raster-puppet` route name them `head`, `eyes`, `brows`, `mouth`, `hand-left`, `hand-right`. `build_puppet_manifest.py` treats `eyes`, `brows`, `mouth` and `nose` as children of the head. Its x/y for them is a first guess: the crop loses where the part sat on the head, so **set their x/y in `puppet.json` after looking at the result**.
- **Expressions as variants of one part:** `mouth--open.png`, `mouth--closed.png`, `eyes--happy.png`, `brows--angry.png`.
- **Four orientations:** `front`, `q`, `side`, `back`. Symmetry gives left and right through `flip`; check asymmetric markings, text and props before mirroring.
- **Anchors:** feet on the ground (present in sprite atlases), hands for props (not yet automated), head for overlays.
- **Code on top:** squash, stretch, arcs and contact shadow belong to the host runtime. Generated poses provide the base, not the polish.

## Recommended starter sets

| Video type | Layers / actions |
| --- | --- |
| Explainer or narrated | presence + `talk`, `point`, `present`, `nod`, `think` |
| Story or humor | presence + locomotion + emotions + `fall`/`hit` |
| Product or tutorial | presence + `talk`, `point`, `present` |
| Minimal mascot | `idle` + `talk` + one emotion |

## Talk snippet (HyperFrames, puppet with `mouth--open` and `mouth--closed`)

Seek-safe: state comes from time and a seeded generator, not from a running timer.

```js
const rand = runtime.rand(7);                 // fixed seed
const beats = Array.from({ length: 24 }, () => 0.12 + rand() * 0.14);   // syllable lengths
const t0 = [0];
beats.forEach((d, i) => t0.push(t0[i] + d));
runtime.porCuadro(tl, 1.0, t0[t0.length - 1], (p) => {
  const t = p * t0[t0.length - 1];
  const i = Math.max(0, t0.findIndex((x) => x > t) - 1);
  runtime.my_character.posar(c, { action: "idle", expression: i % 2 === 0 ? "open" : "closed" });
});
```

Replace `mi_personaje` with the exported namespace. The mouth variant names must exist in the package's expression list.

## Planned, not implemented yet

- A first-class `talk` helper (`hablar`) in the HyperFrames export.
- Hand anchors per frame or joint, for `grab`/`hold`/`release` with props.
- Contact shadow as an export option.
- Turn helper that steps through views.
