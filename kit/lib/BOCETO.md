# Boceto determinista con Rough.js

`MAFIA.boceto` aplica contornos dibujados a mano y rellenos rayados a formas SVG o canvas. Úsalo para una ilustración
con acabado de lápiz, pizarra o plano técnico; no sustituye a GSAP, SVG ni a las formas originales. Cada generación
requiere una semilla explícita para que cualquier fotograma pueda recalcularse en cualquier orden.

## Carga

En `index.html`, antes de `assets/kit/dist/mafia-kit.js`, carga el vendor local:

```html
<script src="assets/kit/lib/vendor/rough/rough.js"></script>
```

El módulo no consulta Rough.js al cargarse. Si se invoca sin cargar el vendor, informa la ruta que falta.

## API

### Formas

`forma` es un objeto con `tipo` y estos campos:

| `tipo` | Campos |
| --- | --- |
| `rect` | `x, y, w, h` |
| `elipse` | `cx, cy, w, h` |
| `circulo` | `cx, cy, d` (diámetro) |
| `linea` | `x1, y1, x2, y2` |
| `poligono`, `polilinea`, `curva` | `puntos: [[x, y], …]` |
| `ruta` | `d` (ruta SVG) |

### Opciones

| Opción | Rough.js | Valor inicial |
| --- | --- | --- |
| `semilla` | `seed` | Obligatoria: entero ≥ 1 |
| `aspereza` | `roughness` | `1` |
| `curvatura` | `bowing` | `1` |
| `color` | `stroke` | `currentColor` |
| `grosor` | `strokeWidth` | `2` |
| `relleno` | `fill` | Sin relleno |
| `estiloRelleno` | `fillStyle` | `hachure` |
| `separacion` | `hachureGap` | Rough.js |
| `angulo` | `hachureAngle` | Rough.js |
| `grosorRelleno` | `fillWeight` | Rough.js |
| `unTrazo` | `disableMultiStroke` | `false` |
| `rough` | Opciones Rough.js sin traducir | `{}` |

`estiloRelleno` admite `hachure`, `solid`, `zigzag`, `cross-hatch`, `dashed` y `zigzag-line`. Las opciones en español
sobrescriben las equivalentes dentro de `rough`; `semilla` siempre fija `seed`.

### SVG

```js
const grupo = MAFIA.boceto.svg("#s01-dibujo", {
  tipo: "rect", x: 120, y: 100, w: 420, h: 240,
}, { semilla: 17, color: "#26221d", grosor: 3, relleno: "#efe4c8", estiloRelleno: "cross-hatch" });
MAFIA.draw(tl, grupo.querySelectorAll("path"), 0.2, 0.8);
```

`MAFIA.boceto.rutas(forma, opciones)` devuelve rutas `{ d, stroke, strokeWidth, fill }` sin tocar el DOM. También se
puede convertir una forma SVG existente; la geometría, `stroke`, `stroke-width` y `fill` se leen de atributos SVG, y
se copia `transform` al grupo nuevo. No se consulta el estilo computado: estilos heredados, clases CSS y hojas externas
pueden dar un resultado distinto. Para conservar su apariencia, fija esos valores como atributos SVG antes de llamar
al helper. Por defecto, el original se oculta escribiendo `style.visibility = "hidden"`; el helper no guarda ni
restaura el valor anterior si después quitas el grupo generado. Usa `{ conservar: true }` si quieres dejar visible el
original, o restaura explícitamente su `style.visibility` al retirar el resultado:

```js
const grupo = MAFIA.boceto.desdeSVG(document.querySelector("#s01-circulo"), { semilla: 23, color: "#25211d" });
// { conservar: true } deja visible la forma original.
```

### Boil

`MAFIA.boceto.hervir(tl, config)` produce varias versiones y muestra una según el tiempo local. Puede recibir
`contenedor` más `forma`, o un `elemento` SVG que se convierte con los mismos atributos de geometría:

```js
MAFIA.boceto.hervir(tl, {
  at: 0, dur: 3, elemento: document.querySelector("#s01-circulo"),
  opts: { semilla: 31, color: "#25211d" }, variantes: 3, fps: 8,
});
```

Devuelve los grupos SVG. `MAFIA.boceto.semillaHervida(semilla, t, { fps, variantes })` permite calcular la misma
secuencia cuando se dibuja en canvas:

```js
const semilla = MAFIA.boceto.semillaHervida(31, tiempoLocal, { fps: 8, variantes: 3 });
MAFIA.boceto.canvas(ctx, { tipo: "curva", puntos: [[40, 90], [120, 20], [220, 90]] }, { semilla });
```

`canvas` dibuja sobre el canvas del contexto 2D recibido y conserva su transformación actual.

## Determinismo

- No omitas `semilla` ni uses `0`; Rough.js recurriría a `Math.random()`.
- `fillStyle: "dots"` no es determinista ni siquiera con semilla; el helper lo rechaza.
- No uses `rough.newSeed()`: también usa `Math.random()`.
- Un relleno `solid` produce un `<path>` relleno sin trazo; `MAFIA.draw` anima los trazos, no la aparición del relleno.
- Rough.js se empaqueta localmente en `kit/lib/vendor/rough/` y su licencia MIT acompaña al vendor.

## Alias en inglés

`MAFIA.sketch` apunta al mismo objeto que `MAFIA.boceto`; incluye `paths`, `svg`, `fromSVG`, `boil`, `canvas` y
`boilSeed` para `rutas`, `svg`, `desdeSVG`, `hervir`, `canvas` y `semillaHervida`.
