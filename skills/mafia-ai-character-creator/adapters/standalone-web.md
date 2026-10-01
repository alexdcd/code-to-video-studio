# Standalone web adapter

The generic generated-art and raster-puppet runtimes are ES modules designed for a modern browser.

## Generated art

```js
import { renderCharacter } from './renderer/character.js';
renderCharacter(document.querySelector('#character'), t, {
  action: 'idle',
  view: 'front',
  expression: 'neutral',
  actionTime: t
});
```

The atlas path is resolved relative to `renderer/character.js` via `import.meta.url`, so moving `demo.html` does not break the asset as long as the package's internal folders stay together.

## One-shot actions

Pass local action time explicitly:

```js
renderCharacter(node, globalTime, {
  action: 'point',
  actionStart: 4.25
});
```

or:

```js
renderCharacter(node, globalTime, {
  action: 'point',
  actionTime: 0.3
});
```

One-shot clips clamp at the final frame rather than wrapping.

See `references/runtime-requirements.md` for the files/dependencies each route needs after sharing the character with somebody else.
