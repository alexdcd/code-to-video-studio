# Studio skills

This directory is the canonical source for portable skills maintained by Code to Video Studio. Agent-specific folders such as `.claude/skills/` and `$CODEX_HOME/skills/` are installation destinations, not editable sources.

## Available skills

The [registry](registry.json) lists each skill's ID, entrypoint, description, tags, and distribution tier (`public`, `pro`, `private`, or `local`). A skill's version lives in its own `VERSION` file and its `DISTRIBUTION-MANIFEST.json` lists every distributable file with its SHA-256 and byte size. Skills are classified independently: keeping one skill private does not make the whole `skills/` directory private.

```bash
pnpm run skills list
pnpm run skills validate mafia-ai-character-creator
pnpm run skills install mafia-ai-character-creator --target claude
pnpm run skills install mafia-ai-character-creator --target codex
pnpm run skills package mafia-ai-character-creator
```

### Packs by tier

Tiers are cumulative: the `pro` pack contains `public + pro`, and `private` contains everything this Studio may use. `local` is never packaged.

```bash
pnpm run skills list --tier pro
pnpm run skills install --tier public --target claude
pnpm run skills package --tier pro          # dist/skills/studio-skills-pro.zip, with PACK.json
```

Delivering a pack to subscribers (download links, licence keys) is outside this repository: the pack ZIP is the unit a store or private release would hand out.

### Third-party skills

A skill adapted from another project keeps the original files **unmodified** under `references/` and carries the adaptation in its own `SKILL.md`, which states that `AGENTS.md`, the project `BRIEF.md` and the Studio's technical rules take precedence. Its `UPSTREAM.json` pins the repository, commit, licence and the file mapping; `NOTICE.md` records provenance and what was changed or left out.

```bash
pnpm run skills upstream check gsap-video     # compares the pinned files with the upstream default branch
pnpm run skills upstream update gsap-video    # copies changed files and pins the new commit
```

After an update: read the diff, confirm `SKILL.md` still overrides every conflict, bump `VERSION`, run `manifest update` and `validate`. Skills without their own `scripts/validate_skill.py` get a generic validation (frontmatter, referenced files, `UPSTREAM.json`).

| Skill | Upstream | Licence | Taken | Left out |
| --- | --- | --- | --- | --- |
| `gsap-video` | greensock/gsap-skills | MIT | core, timeline, plugins, utils | scrolltrigger, react, frameworks, performance |
| `algorithmic-art-video` | anthropics/skills | Apache-2.0 | the algorithmic-art method | p5.js viewer and templates |

Use `--target claude-local` to install into this checkout's ignored `.claude/skills/` directory. Install verifies the source manifest and refuses to overwrite an installed directory that has untracked or modified files unless `--force` is passed. A previously installed, intact version can be updated safely.

`package` writes a ZIP under `dist/skills/` by default. Only files named by the distribution manifest, plus the manifest itself, enter the archive. Maintainers can refresh a package manifest with `pnpm run skills manifest update <id>` after editing its files, then validate and package it.

See [`docs/architecture/distribution.md`](../docs/architecture/distribution.md) for the Studio-wide public / Pro / private / local model.
