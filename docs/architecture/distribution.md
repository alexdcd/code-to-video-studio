# Distribution architecture

This repository is the **canonical production superset**. Public and future Pro editions are distributions of this Studio, not independent sources of truth.

```text
canonical Studio
      │
      ├── public  → Code to Video Studio
      ├── pro     → public + Pro resources
      └── private → public + Pro + private production material

local runtimes/caches never enter a distribution
```

## Distribution tiers

Every reusable capability or resource belongs to one of four tiers:

- **public** — may be redistributed in the open-source Studio.
- **pro** — may be redistributed in a Pro/commercial edition, but not in the public repository.
- **private** — tracked production material for the canonical Studio only.
- **local** — machine-local state such as model weights, caches, virtual environments, credentials and rendered intermediates. Local material must not be tracked.

Internal design and decision records live in `docs/architecture/` and are private. User guides live in
`docs/<capability>.md`, are public and ship in the same PR as the capability, never earlier or as empty
placeholders. This shared distribution guide is an explicit exception.

The tiers are cumulative for products: Pro may contain `public + pro`; the private Studio may use `public + pro + private`. `local` is never a distributable tier.

## Safe defaults

Infrastructure is designed to be shareable. Creative material is conservative by default.

- Generic runtime/helpers under `kit/lib/`, generic scripts and generic tools are public candidates.
- `projects/` / `proyectos/` are private by default.
- Creative kit material (characters, styles, brands, fonts, sounds, textures, etc.) is private unless explicitly classified.
- Skills are classified individually in `skills/registry.json`.
- Heavy runtimes/models belong outside the repository and are local.
- Repository-specific integration glue may remain private even when the underlying capability is public.

A resource does **not** become public merely because its license is permissive. Distribution tier and license are separate decisions.

## Resource manifests

A reusable creative resource can override its directory default with a `resource.json`:

```json
{
  "schemaVersion": 1,
  "id": "paper-noise-01",
  "type": "texture",
  "distribution": "public",
  "license": "CC0-1.0",
  "source": "generated"
}
```

Public and Pro resources must declare a redistribution license. Private resources may omit it when the rights/provenance are intentionally internal, although documenting provenance is still recommended.

The manifest applies to its directory subtree. Use it to promote one character/style/font/sound pack without reorganizing paths.

## Skills

`skills/` is canonical. Agent-specific locations such as `.claude/skills/`, `~/.claude/skills/` and `$CODEX_HOME/skills/` are installation targets.

Each entry in `skills/registry.json` declares its `distribution` tier. A public skill can be transferred as a manifest-governed package without making every skill public.

Skills are also delivered as cumulative packs (`pnpm run skills package --tier public|pro|private`): one ZIP with a `PACK.json` and each skill's manifest-governed files. A Pro offer is the `pro` pack; how it reaches subscribers is a store/release concern, not something this repository implements.

Skills adapted from third parties keep the upstream files unmodified and pin their source in `UPSTREAM.json`. Their tier follows the same rule as everything else: a permissive upstream licence makes a skill *eligible*, not automatically public.

## Projects

Projects are private by default because they commonly contain prompts, voices, generated art, music, client material, local paths and one-off creative decisions. A project should only become a public example through an explicit, reviewed export; never by a broad directory sync rule.

## Local resources

Model weights, virtual environments and caches belong in a machine-level cache such as:

```text
~/.cache/code-to-video-studio/
```

or an explicit override. Adapters may be public while their installed models remain local.

## Commands

The canonical Studio validates classification with:

```bash
pnpm run distribution:check
pnpm run distribution:plan --target public
pnpm run distribution:plan --target pro
pnpm run distribution:explain kit/personajes/my-character/asset.webp
```

`distribution:plan` reports **eligibility**, not an automatic copy operation. The current public transfer mechanism remains the explicit allowlist in `tools/public-sync/`; the distribution checker verifies that anything mapped to the public repository is actually classified `public`.

## Promotion flow

Reusable work is developed and validated in the canonical Studio first:

```text
production use
    ↓
stabilize contract
    ↓
classify distribution + license
    ↓
public/pro adapter or package
    ↓
explicit distribution sync
```

Do not maintain divergent implementations by hand when a shared package/mapping can safely keep them aligned.
