# Character package contract

A shareable release-ready character must include its own runtime documentation.

## Generated-art package

```text
<character>/
├── README.md
├── CHARACTER.md
├── character.json
├── demo.html
├── renderer/
│   └── character.js
├── assets/
│   ├── atlas.webp
│   └── atlas.json
├── references/
└── qa/
    ├── frames/
    │   ├── views/
    │   └── actions/
    ├── determinism/
    │   ├── forward/
    │   ├── reverse/
    │   └── fresh/
    ├── previews/
    ├── views.png
    ├── contact-sheet.png
    ├── view-continuity.json
    ├── determinism.json
    ├── runtime-probe.json
    ├── runtime-contract.json
    └── visual-review.json
```

## Raster-puppet package

Replace the atlas assets with:

```text
assets/
├── puppet.json
└── parts/
    ├── head.webp
    ├── torso.webp
    └── ...
```

## Manifest

`character.json` schema version 2 declares:

- identity (`id`, `displayName`, `description`);
- `renderMode`;
- all `views` and release-gating `requiredViews`;
- semantic `actions`, `expressions`, and optional props;
- renderer entry/module system/API symbols.

## Atlas contract v2

Generated-art `atlas.json` records:

- atlas image and dimensions;
- fixed cell dimensions;
- one `single-global-scale` normalization value;
- common `feet-center` anchor;
- clips keyed by `view|expression|action`;
- `loop`/`once` playback per clip;
- per-frame cell, anchor, source bbox, and normalized subject bbox.

A package must not claim a view/action/expression that is absent from its atlas clips.

## Runtime evidence

`runtime-contract.json` may not infer success from `character.json`. It must be created from external browser-probe evidence (`probe_browser_runtime.mjs`) and must hash both:

- the current renderer entry;
- the exact probe evidence file copied into the package.

## QA evidence

Reports are not trusted merely because they contain `"ok": true`.

- continuity reports hash the exact view files measured;
- determinism reports hash forward/reverse/fresh render evidence;
- runtime contracts hash renderer + browser probe;
- visual-review reports hash every artifact actually reviewed.

The release validator rejects stale evidence after relevant files change.
