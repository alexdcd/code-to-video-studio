# HyperFrames adapter

This optional adapter exports generated-art sprites or raster puppets as non-ESM character runtimes for a HyperFrames kit. The exporter reads its paths, runtime global, and optional build/version policy from a target JSON file; the core exporter does not assume a repository layout.

## Bundled target

The `code-to-video-studio` target writes to `kit/characters/`, uses `assets/kit/characters/` for runtime URLs, and uses the target's `MAFIA` runtime global.

```bash
python scripts/generate_hyperframes_character.py character \
  /path/to/character \
  --target code-to-video-studio \
  --project-root .
```

Generated-art exports contain:

```text
kit/characters/<slug>/
├── <slug>.js
├── atlas.webp
├── atlas.json
├── ficha.json
├── demo.html
└── README.md
```

Raster-puppet exports contain the same wrapper files plus `puppet.json` and `parts/` instead of an atlas. Both expose `insertar(..., { ancho })`; puppet width is based on visible content bounds, not the authoring canvas.

## Custom targets

The exporter first checks `<project-root>/tools/skill-targets/<target>.json`, then the bundled `adapters/<target>/target.json`. A target may define:

```json
{
  "schemaVersion": 1,
  "id": "example-studio",
  "characterDir": "kit/characters",
  "assetPrefix": "assets/kit/characters",
  "runtime": "MAFIA",
  "buildCommand": "node scripts/lib/kit-build.mjs",
  "catalogCommand": "node scripts/lib/catalog.mjs",
  "versionFile": "kit/VERSION",
  "versionBump": "minor"
}
```

`characterDir`, `assetPrefix`, and `versionFile` are relative paths with no parent traversal. `runtime` is a JavaScript global identifier. Build and catalog commands can be strings or argument arrays and run without a shell from the project root. Keep repository-specific target files outside the skill package unless they are safe to distribute.

Export without finalization only writes the character directory. Pass `--finalize` to apply the configured minor version bump and run the target's build/catalog commands. Pass `--force` only when replacing an existing export intentionally.

## Runtime API

For sprites, `animar()` uses the configured runtime's `porCuadro()` helper for seek-safe frame selection. For puppets, `animar()` interpolates named poses through the same helper; `posar()` applies a pose immediately and `ciclo()` cycles across multiple poses. Optional jump/reaction helpers use the configured runtime's `anim` helpers when available.
