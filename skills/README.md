# Studio skills

This directory is the canonical source for portable skills maintained by Code to Video Studio. Agent-specific folders such as `.claude/skills/` and `$CODEX_HOME/skills/` are installation destinations, not editable sources.

## Available skills

The [registry](registry.json) lists each skill's ID, entrypoint, description, and tags. A skill's version lives in its own `VERSION` file and its `DISTRIBUTION-MANIFEST.json` lists every distributable file with its SHA-256 and byte size.

```bash
npm run skills -- list
npm run skills -- validate mafia-ai-character-creator
npm run skills -- install mafia-ai-character-creator --target claude
npm run skills -- install mafia-ai-character-creator --target codex
npm run skills -- package mafia-ai-character-creator
```

Use `--target claude-local` to install into this checkout's ignored `.claude/skills/` directory. Install verifies the source manifest and refuses to overwrite an installed directory that has untracked or modified files unless `--force` is passed. A previously installed, intact version can be updated safely.

`package` writes a ZIP under `dist/skills/` by default. Only files named by the distribution manifest, plus the manifest itself, enter the archive. Maintainers can refresh a package manifest with `npm run skills -- manifest update <id>` after editing its files, then validate and package it.
