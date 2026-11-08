# Studio skills

This directory is the canonical source for portable skills maintained by the Studio. Agent-specific folders such as `.claude/skills/` and `$CODEX_HOME/skills/` are installation destinations, not editable sources. The registry classifies each skill as `public`, `pro`, `private` or `local`; each package's version and SHA-256 distribution manifest define its distributable files.

## Public skills

| Skill | What it helps with |
| --- | --- |
| [`mafia-ai-character-creator`](mafia-ai-character-creator/SKILL.md) | Create and QA reusable animated characters. |
| [`gsap-video`](gsap-video/SKILL.md) | Use GSAP safely in deterministic, frame-rendered video. |
| [`algorithmic-art-video`](algorithmic-art-video/SKILL.md) | Design seeded generative art for HyperFrames scenes. |
| [`reference-analyst`](reference-analyst/SKILL.md) | Inspect a requested video reference and record evidence. |
| [`creative-review`](creative-review/SKILL.md) | Review a storyboard or render against its brief, style and visual evidence. |

Install the public skills from the Studio root:

```bash
pnpm run skills list --tier public
pnpm run skills validate --tier public
pnpm run skills install --tier public --target claude
pnpm run skills install --tier public --target codex
```

The public edition receives `reference-analyst` and `creative-review` with the `analyze`, `review` and `status` commands they use. Its registry lists only skills available in that edition.

## Pro skills

`style-from-reference` converts inspected reference ingredients into an original reusable style. `social-video-refresh` prepares an editorially adapted, independent video variant; its Pro package contains the portable variant engine and workflow. The canonical Studio keeps `pnpm run variante` as a small compatibility adapter, while Code to Video Studio calls the installed skill's engine with an explicit Studio path. Both skills are excluded from the free distribution.

Use `pnpm run skills validate <id>` to check a package or `pnpm run skills package <id>` to create a manifest-verified ZIP. The `pro` pack contains public and Pro skills. Install verifies hashes and refuses to replace a modified installation unless `--force` is supplied.

## Third-party references

Adapted third-party skills keep their original reference files unchanged under `references/` and carry Studio-specific rules in `SKILL.md`. See each package's `UPSTREAM.json`, `NOTICE.md` and license files for provenance and terms. After an upstream update, review the diff, bump `VERSION`, refresh the manifest, and validate the package.

| Skill | Upstream | Licence | Included |
| --- | --- | --- | --- |
| `gsap-video` | greensock/gsap-skills | MIT | Core, timeline, plugins and utilities |
| `algorithmic-art-video` | anthropics/skills | Apache-2.0 | Method only; no upstream viewer or templates |
| biblioteca-motion | showheyohtaki/motion-prompt | MIT | Pinned official lookup CLI |
