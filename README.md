# Code to Video Studio — Mafia AI

[![CI](https://github.com/alexdcd/code-to-video-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/alexdcd/code-to-video-studio/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node 22+](https://img.shields.io/badge/node-22%2B-brightgreen.svg)](package.json)

**Turn a brief into a polished, programmable video with an AI coding agent.**

Code to Video Studio is an open source, agent-first workspace for creating animated videos with **code instead of a timeline editor**. It gives Claude Code, Codex and other coding agents a production system they can understand: brief, script, storyboard, reusable motion primitives, deterministic animation, visual checks and final render.

Built on **HyperFrames + GSAP**, with a small reusable motion kit designed for videos that need to be iterated, regenerated and reviewed like software.

> **The idea:** describe the video you want, let your coding agent build it inside a constrained production system, preview it, inspect key frames, fix what is wrong and render the final MP4.

---

## Why this exists

AI can already write impressive animation code. The harder problem is getting it to produce a **good video repeatedly**.

Without a system, an agent tends to create a one-off HTML experiment: timings drift, scenes fight for attention, motion breaks when you seek, files become hard to reuse and every new video starts almost from zero.

Code to Video Studio gives the agent a production grammar.

```text
BRIEF
  ↓
SCRIPT
  ↓
STORYBOARD
  ↓
SCENES + MOTION
  ↓
CHECK + SNAPSHOTS
  ↓
VISUAL REVIEW
  ↓
RENDER
```

The repository grew out of several days of hands-on production, repeated renders, failed experiments, visual QA and refactoring while building real programmatic videos. The useful parts were turned into reusable rules and primitives instead of being left inside one finished project.

This is not a prompt collection and not a single demo. It is a base for building your own **code-to-video workflow**.

---

## What makes it different

### Agent-first, not agent-added

The project is structured so a coding agent can understand how to work before it writes a scene. `AGENTS.md` defines the workflow, timing rules, determinism constraints and visual review loop.

### Deterministic animation

Video rendering needs to survive seeking, snapshots and frame-by-frame rendering. The included `MAFIA` helpers avoid common stateful-animation traps and provide seeded randomness and time-based motion.

### Reusable motion language

Instead of rewriting the same animation logic on every video:

```js
MAFIA.anim.spring(...)
MAFIA.anim.arc(...)
MAFIA.anim.jump(...)
MAFIA.anim.shake(...)
MAFIA.anim.pulse(...)
MAFIA.draw(...)
MAFIA.pop(...)
MAFIA.porCuadro(...)
```

### Visual QA is part of the workflow

A video is not correct because the code runs. The workflow explicitly asks the agent to inspect key poses, snapshots and a contact sheet before calling the result finished.

### Your style stays yours

The public starter is intentionally neutral. Build your own styles, characters, scenes, typography and brand kits on top of the core instead of inheriting someone else's visual identity.

---

## What can you build?

The system is especially useful for:

- short-form explainers
- animated AI / technology content
- data stories and visual essays
- product explainers
- kinetic typography
- code-drawn diagrams
- music-led motion pieces
- recurring branded video formats
- animated characters and reusable scene systems

It is not trying to replace Premiere, After Effects or a full nonlinear editor. It is strongest when the video benefits from being **generated, versioned, repeated or controlled by code**.

---

## Quick start

Requirements:

- Node.js 22+
- ffmpeg
- a coding agent is strongly recommended

```bash
git clone https://github.com/alexdcd/code-to-video-studio.git
cd code-to-video-studio

npm install
npm run setup

npm run new -- starter-9x16 my-video
npm run dev -- my-video
```

Then open the repository with Claude Code, Codex or your preferred coding agent and try:

> Read AGENTS.md and proyectos/my-video/BRIEF.md. Create a 15-second vertical video explaining how an AI agent turns a goal into actions. Keep one important visual idea on screen at a time. Use the starter style as a base, but create original scenes. Validate the project and inspect key snapshots before rendering.

When it is ready:

```bash
npm run check -- my-video
npm run render -- my-video
npm run contact-sheet -- proyectos/my-video/renders/my-video.mp4
```

---

## The workflow

### 1. Brief

Define the outcome, audience, format, duration, voice, sound and non-negotiables.

### 2. Script

Decide what the viewer needs to understand and in what order.

### 3. Storyboard

Every scene gets:

- one primary event or change
- visual readings in order
- timing
- reusable resources
- important sound or motion beats

### 4. Build

Scenes live in isolated compositions and use deterministic timelines. Project-specific work stays outside the reusable kit.

### 5. Check visually

Run validation, inspect important moments, then create a contact sheet for the whole render. Motion and composition should be judged visually, not from source code alone.

### 6. Promote what is reusable

If a scene, character, helper or style works across projects, move it into the kit instead of copy-pasting it forever.

That makes the studio improve every time you make a video.

---

## Repository map

```text
kit/
  lib/                  reusable MAFIA helpers + deterministic cartoon motion
  styles/               reusable visual systems
  characters/           reusable code-driven characters

templates/
  _common/              project contract: brief, script, storyboard, agent notes
  starter-9x16/         neutral vertical starter

proyectos/
  demo/                 small working example

scripts/
  new.sh                 create a project
  in-project.sh          run HyperFrames commands against a project
  kit-copy.sh            copy the current kit into a project
  contact-sheet.sh       visual review helper

docs/
  agent-workflow.md
  animation.md
  creating-styles.md
  creating-characters.md
```

---

## Why HyperFrames + GSAP?

**HyperFrames** gives code a video-oriented runtime: compositions, preview, snapshots, validation and rendering.

**GSAP** gives the scene layer expressive timelines and mature animation primitives.

Code to Video Studio adds the missing production layer around them:

- project structure
- agent instructions
- deterministic helpers
- reusable motion
- reusable styles and characters
- review discipline
- promotion of successful work back into the kit

The goal is not to hide the underlying tools. It is to make them easier for an AI agent and a human creator to use together.

---

## A few rules that matter

Programmatic video has different failure modes from ordinary web animation.

- Never use unseeded `Math.random()` for rendered state.
- Do not build animation state by accumulating frame-to-frame physics.
- Important motion must be derived from time so seeking remains correct.
- Keep scene IDs unique after compositions are assembled.
- Review key poses and transitions visually.
- One important reading at a time beats five simultaneous clever effects.

The full contract lives in [AGENTS.md](AGENTS.md).

---

## The MAFIA motion layer

The project exposes a deliberately small global helper layer:

```js
const r = MAFIA.rand(42);

const pose = MAFIA.anim.jump(t, 1.0, 1.7, 120);
const wobble = MAFIA.anim.spring(t, 1.7);
const [x, y] = MAFIA.anim.shake(t, 6, 24, 9);
```

It is designed around a simple constraint:

> **Given the same time and seed, the frame should be reproducible.**

That makes agent-generated motion much safer to snapshot, debug and render.

---

## Build your own visual system

The starter style is not the product's identity. It is an example of the contract.

A reusable style can define:

- palette
- typography
- composition rules
- transitions
- camera language
- recurring visual motifs
- helper functions
- scene conventions

A reusable character can define:

- structure
- expressions
- poses
- entrances and exits
- deterministic actions
- animation helpers

The aim is to let creators build a **video system that compounds**, rather than prompting a new aesthetic from scratch every time.

---

## Public core and creator layers

This repository contains the open core and a neutral starter.

Mafia AI's own production projects, brand assets and private creative libraries are intentionally separate. That separation is useful even if you are not Mafia AI: keep your reusable engine independent from the assets that make your work recognizably yours.

---

## Status

**Early public release.**

The core comes from a working private production system, but this public distribution is intentionally smaller and cleaner. Expect the public API and starter kit to evolve as more real videos are produced with it.

Issues and focused pull requests are welcome.

---

## Roadmap

Near-term areas worth exploring:

- better starter scenes and examples
- reusable chart / diagram primitives
- character kits
- audio-aware timing helpers
- easier project creation
- more automated visual QA
- community styles without coupling them to the core
- improved agent workflows for Claude Code, Codex and other coding agents

The roadmap will follow real production needs rather than trying to become a giant all-purpose video framework.

---

## Made something with it?

Open a showcase issue or send a PR adding your project to the community examples once that gallery exists. Real outputs are the best way to improve the studio.

If the project is useful to you, a GitHub star helps other creators discover it.

---

## Contributing

If you create a reusable fix, helper, scene primitive or genuinely general workflow improvement, contributions are welcome.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) first. Keep the core generic: brand-specific assets and one-off project code are better kept in your own layer.

---

## License

Code in this repository is released under the [Apache License 2.0](LICENSE).

**Mafia AI**, **La Mafia IA**, their names, logos and brand identity are not granted under the software license. See [TRADEMARKS.md](TRADEMARKS.md).

Third-party dependencies keep their respective licenses.

---

## Built by Mafia AI

Code to Video Studio is maintained by **Mafia AI** as part of an ongoing experiment in using AI agents as creative production partners, not just code generators.

If you build something interesting with it, open an issue or share the result. The most useful ideas for the project will come from seeing what people actually make.
