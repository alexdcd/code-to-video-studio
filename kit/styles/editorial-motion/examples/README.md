# Editorial Motion examples

The templates `editorial-motion-16x9` and `editorial-motion-9x16` are runnable examples. They demonstrate text entry, a checked SVG morph, parallax, a masked camera transition and format-specific composition. Start from either template and replace the sample story, keeping the style's visual rules from `../GUIA.md`.

Minimal reusable motion:

```js
const EM = MAFIA.editorialMotion;
const tl = gsap.timeline({ paused: true });
EM.entrar(tl, "#s00-titular", 0.12, { dur: 0.5, y: 64 });
EM.morph(tl, "#s02-forma", "M 130 22 C 166 66 206 104 238 130 C 206 156 166 194 130 238 C 94 194 54 156 22 130 C 54 104 94 66 130 22 Z", 0.7);
window.__timelines.s00 = tl;
```

The public Studio installs the pinned MorphSVG plugin with the rest of its runtime; the style does not download assets at render time.
