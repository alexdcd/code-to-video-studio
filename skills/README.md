# Studio skills

Portable agent skills live here. The registry and each skill's SHA-256 distribution manifest are the source of truth; Claude Code and Codex folders are installation destinations.

## Public skills

| Skill | What it helps with |
| --- | --- |
| [`mafia-ai-character-creator`](mafia-ai-character-creator/SKILL.md) | Create and QA reusable animated characters. |
| [`gsap-video`](gsap-video/SKILL.md) | Use GSAP safely in deterministic, frame rendered video. |
| [`algorithmic-art-video`](algorithmic-art-video/SKILL.md) | Design seeded generative art for HyperFrames scenes. |
| [`reference-analyst`](reference-analyst/SKILL.md) | Measure and inspect a named video reference, then record evidence and reusable observations. |
| [`creative-review`](creative-review/SKILL.md) | Review a storyboard or render against its brief, selected style and visual evidence. |

An agent can install these from the repository root:

```bash
pnpm run skills list --tier public
pnpm run skills validate --tier public
pnpm run skills install --tier public --target claude
pnpm run skills install --tier public --target codex
```

Use `pnpm run skills validate <id>` to check one package or `pnpm run skills package <id>` to create a manifest verified ZIP for sharing that skill.

Each skill manifest lists every distributable file with its SHA-256 and byte size. Install verifies those hashes and refuses to replace a modified installation unless `--force` is supplied.

## Third party references

Adapted third party skills keep their original reference files unchanged under `references/` and carry the Studio-specific video rules in `SKILL.md`. See each package's `UPSTREAM.json`, `NOTICE.md` and license files for provenance and terms.
