# Capability index

Check this index before building a new helper or installing another tool. Prefer the existing capability that fits the job; add a new dependency only when it closes a clear gap.

| Need | Use | Requirements / limits |
| --- | --- | --- |
| Deterministic randomness and frame callbacks | `MAFIA.rand` and `MAFIA.eachFrame` in `kit/lib/mafia.js` | State must be derived from the seek time. |
| Expressive time-driven motion | `MAFIA.anim` in `kit/lib/cartoon-motion.js` | Keyframes, curves, arcs, springs, jumps, and reactions stay derived from time. |
| Time remapping after a narration change | `MAFIA.mapaTiempo` plus `pnpm run voice:map` | Local transcript, Python 3, FFmpeg/FFprobe; manual anchors may be needed. |
| Phrase timing and subtitle groups | `pnpm run voice:phrases` and `MAFIA.subs` | Local transcript and audio; does not generate speech. |
| Sketch rendering | `MAFIA.boceto` in `kit/lib/boceto.js` | Always provide an integer seed. |
| Deterministic physics | `MAFIA.fisica` in `kit/lib/fisica.js` | Precomputed with a fixed step; query by time. |
| Reusable visual effects | `MAFIA.fx` in `kit/lib/fx.js` | Inspect the API and current kit before implementing a named effect by hand. |
| 3D annotations and blur | `kit/lib/three-anotaciones.js`, `kit/lib/three-desenfoque.js` | Use HyperFrames' seek event and declare composition duration. |
| Lottie animation | `MAFIA.lottie` in `kit/lib/mafia.js` | Load the local runtime and animation data; rendering remains seek-driven. |
| Analyze a requested video reference | `pnpm run analyze ... --mode reference` | Local file only; inspection is opt-in; needs Python 3 and FFmpeg/FFprobe. |
| Inspect a storyboard or rendered project | `pnpm run review` | Visual review is performed by the agent from generated evidence. |
| Derive progress from a project | `pnpm run status` | Reads files; approval flags explicitly update `meta.json`. |
| Create an isolated project edition | `pnpm run variant` | Sibling folders only; skips renders, secrets, caches, and model files. |
| Verify a final render | `pnpm run qa` | FFmpeg/FFprobe and Python 3; reports measurable signals, not taste. |
| Create numbered and social renders | `pnpm run render` | Pinned HyperFrames and FFmpeg; never overwrites a version. |
| Export a web-optimized master | `pnpm run web:encode` | FFmpeg; constant-quality H.264 with metadata removed. |
| Find candidate sound effects | `pnpm run sfx:candidates` | Optional sound search; inspect licensing and listen before use. |

## Not in the core yet

- Local speech generation and music model weights are not installed or downloaded by setup. Their runtimes and licenses need a separate opt-in package.
- Narration tempo editing is not part of first-render dependencies. The private reference implementation depends on NumPy and an editorial mixing recipe, so this release provides timing maps and phrase alignment without silently changing audio.
- Exact, beat-level music synchronization should use a video-clock-driven score. A free-running generated bed does not guarantee exact scene hits.
- Reference video downloads, hosted transcription, and paid provider integrations are not invoked by these commands.
