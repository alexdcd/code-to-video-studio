# Upstream adaptation map

Mafia AI Character Creator is not a rename of `hatch-pet`. It generalizes the original workflow from one fixed Codex-pet atlas contract into a public animation-character system while preserving the production tooling that made the original robust.

## From `hatch-pet` (Apache-2.0)

| Original capability | Treatment here |
|---|---|
| canonical base image | retained as identity source of truth |
| run preparation / manifests | generalized |
| image-model generation workflow | retained and made the default route |
| chroma background workflow | retained and generalized |
| chroma despill | retained and generalized for arbitrary image sizes |
| row/strip extraction | retained + generic grid extraction added |
| 8×11 fixed atlas | replaced by configurable generic atlas metadata |
| atlas playback | generated automatically by `build_sprite_renderer.py` |
| frame inspection | retained/generalized |
| contact sheets | retained/generalized |
| motion preview GIFs | retained/generalized |
| direction continuity | adapted to project-declared required views |
| blind/independent QA principle | retained as visual-review policy |
| smallest-scope repair | retained |
| 16 look directions | removed as universal requirement |
| `spriteVersionNumber: 2` | removed |

The public default requires `front/q/side`; projects can request rear views or another view system.

## From ClaudeAnimationBase (MIT)

Reference: `JohnHeibel/ClaudeAnimationBase` commit `0ac8bf2b31942376cb6b8c4074715595d512acd2`.

Adopted as principles:

- frames must be functions of explicit time/state, not accumulated hidden playback state;
- key views can be superior to fake 3D turns for 2D characters;
- readable acting uses anticipation, action, read/impact, and settle;
- visual QA should include view sheets, motion strips, crops/contact sheets;
- controlled seeds are required for boil/jitter.

Not imposed as public-core requirements:

- p5.js / p5.brush;
- its renderer/studio;
- Clawd's design;
- its specific aesthetic/no-text rules.
