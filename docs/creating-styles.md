# Creating styles

A style is a reusable visual system, not just a CSS file.

Put public reusable styles in:

```text
kit/styles/<name>/
  GUIDE.md
  style.css
  style.js
  ficha.json
```

A useful style guide should define:

- when to use the style
- visual hierarchy
- palette and typography
- motion language
- scene density
- transitions
- what the style deliberately does not do
- its ambition defaults: how the camera moves, how the hero gets its scale, how objects or data get built on screen (see the «Ambición por defecto» sections in the bundled styles)

Keep brand-specific logos and private identity systems outside the public core.

The included `starter` style is intentionally neutral. Copy its contract, not necessarily its appearance.
