# Contributing

Mafia AI Character Creator is intended to remain useful outside any one repo, model provider, or brand.

## Requirements for changes

- Keep the core provider-neutral and project-neutral.
- Keep generated-art as an accessible default route.
- Keep `raster-puppet`, rigged, and procedural routes available for characters that need more continuity or acting.
- Do not weaken determinism, runtime-probe, or hashed visual-QA gates.
- New release-ready character formats must document their runtime dependencies in the generated character README.
- Do not add private profiles, secrets, local machine paths, or proprietary character art to the public package.
- Preserve Apache/MIT notices for adapted upstream work.
- Add a regression test for every bug fix that can be reproduced programmatically.

Before proposing a release:

```bash
python scripts/validate_skill.py .
pytest -q
```
