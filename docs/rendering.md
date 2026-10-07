# Versioned renders

Render a project from the repository root:

```bash
pnpm run render <project> "what changed"
```

The command chooses the next free `vNN` number and writes a master MP4 plus a `-redes.mp4` copy under the project's `renders/` directory.
It never reuses an existing version. After both files finish, it appends the version, local date and note to `renders/VERSIONES.txt`.

The social copy uses H.264, `slow`, CRF 22, a 16 Mb/s maximum rate, a 32 Mb buffer, `yuv420p`, fast start and AAC audio at 192 kb/s. If a
platform requires a smaller file, set `REDES_CRF` to a value from 18 to 24 for that render.

The renderer rejects symlinked output paths and render directories. The ledger must be a regular file with no hardlinks; this prevents appending
version history through a path that aliases a file outside the project.

Use `pnpm run web:encode <master.mp4>` to create a separate quality-focused web export from the master.
