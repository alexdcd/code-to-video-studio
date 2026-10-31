# Project variants

Create an independent project for a language, aspect ratio, or editorial edition:

```bash
pnpm run variant my-video english --language en-US
pnpm run variant my-video--english vertical
```

A variant is a sibling under the selected project root, with a name such as `my-video--english`. The command resolves variant ancestry from `meta.json`, so variants of variants remain flat siblings instead of nesting project folders. HyperFrames continues to scan one project directory at a time.

The copy includes source files, compositions, and project assets. It omits renders, snapshots, dependency folders, caches, virtual environments, secrets, and model weights. Existing destinations are never overwritten. Symlinks and hard-linked files in retained content are rejected. The source project is left intact.

The new `meta.json` records its parent, immediate source, origin dates, and available source render version. Prior approvals are removed because approval of a parent project does not approve its variant. Setting `--language` updates `narration_language` in the copied brief, adding frontmatter when the public template has none; it does not translate the script or regenerate narration.

Use an absolute `CTV_PROJECTS_ROOT` when projects should live outside the repository. The project root must be a single directory, and variant folders are not discovered recursively.
