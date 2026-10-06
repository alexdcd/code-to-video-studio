# Studio distribution policy

This directory implements the classification layer for the canonical Studio.

- `policy.json` contains repository-specific default path rules.
- `resource.schema.json` describes optional `resource.json` manifests for creative assets.
- `lib.mjs` contains reusable tier/path validation.
- `cli.mjs` provides `check`, `plan` and `explain`.
- `tests/` covers tier resolution and safety rules.

The classification layer does **not** copy files to another repository. Public transfer still uses the explicit allowlist/package manifests in `tools/public-sync/`. Keeping classification and transfer separate means a file can be safe to publish without forcing both repositories to have the same physical layout.

## Tiers

```text
public   may appear in the open-source distribution
pro      may appear in Pro, not public
private  canonical Studio only
local    machine-only; must not be tracked
```

Creative resources are private unless promoted explicitly. Skills declare their tier in `skills/registry.json`. A `resource.json` can classify a specific creative subtree without moving it.

Run:

```bash
pnpm run distribution:check
pnpm run distribution:plan --target public
pnpm run distribution:explain <repo-path>
pnpm run distribution:test
```

The checker also verifies that public-sync sources resolve to the `public` tier and scans public/Pro text files for obvious secrets or machine-specific authoring paths.
