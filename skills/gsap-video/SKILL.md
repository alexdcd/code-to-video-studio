---
name: gsap-video
description: GSAP para vídeo renderizado fotograma a fotograma (HyperFrames). Skills oficiales de GreenSock (core, timeline, plugins, utils) adaptadas a render determinista. Úsala al escribir o revisar animación GSAP de una composición, sobre todo con SplitText, MorphSVG, DrawSVG, MotionPath, ScrambleText o CustomEase, o con eases, staggers y la posición en la timeline.
license: MIT (contenido de GreenSock en references/, ver LICENSE.txt)
---

# GSAP para vídeo

Las referencias de `references/` son las skills oficiales de GreenSock **sin modificar** (procedencia en
`UPSTREAM.json`). Están escritas para webs interactivas; aquí la página no se reproduce: HyperFrames mueve el
cabezal de una timeline pausada a cada fotograma y captura. Esta hoja es la única adaptación y **prevalece** sobre
las referencias.

## Prioridad

1. Instrucciones del usuario y `BRIEF.md` del proyecto.
2. `AGENTS.md` del repositorio (sobre todo «Reglas técnicas») y las skills `/hyperframes-*`.
3. Esta hoja.
4. `references/` (GreenSock).

Si una referencia contradice algo de arriba, gana lo de arriba sin discutirlo.

## Reglas de vídeo (sustituyen a las de la web)

- **Una timeline pausada por composición**, registrada en `window.__timelines["<id>"]`. Nunca `play()`, `pause()`,
  `reverse()`, `restart()`, `timeScale()` ni `seek()` desde el código: el reloj es de HyperFrames.
- **Nada infinito:** prohibido `repeat: -1`. Repeticiones finitas, calculadas para la duración
  (`MAFIA.ciclos(total, ciclo)`).
- **Azar con semilla:** `gsap.utils.random()`, `gsap.utils.shuffle()`, `stagger: { from: "random" }` y los valores
  `"random(…)"` usan `Math.random()`: no son deterministas. Usa `MAFIA.rand(semilla)` y pasa el resultado
  (`stagger: { each: 0.05, from: índiceCalculado }`, arrays barajados con la semilla, valores por función).
- **Estado por tiempo, no acumulado:** lo que se dibuja o calcula (canvas, contadores, texto) va en
  `MAFIA.porCuadro(tl, at, dur, fn)`. No uses `onUpdate`/`onComplete` para cambiar estado: el seek puede saltarlos.
- **Varios `from`/`fromTo` sobre el mismo elemento:** los posteriores con `immediateRender: false`.
- **No animes `.clip` con `autoAlpha`/`visibility`/`display`**: anima un envoltorio interior. Fuera de `.clip`,
  `autoAlpha` sirve.
- **Sin `transform` en CSS** sobre lo que anima GSAP; usa los alias (`x`, `y`, `scale`, `rotation`, `xPercent`).
  Elementos transformados: block-level y con tamaño.
- **Fuera de alcance:** ScrollTrigger, ScrollSmoother, ScrollTo, Observer, Draggable, Inertia, `quickTo`,
  `matchMedia`/`prefers-reduced-motion`, `will-change` y React/Vue. En vídeo no hay scroll, ratón ni usuario.

## Plugins disponibles

El kit trae y registra (`kit/lib/mafia.js`): **SplitText, MorphSVG, DrawSVG, MotionPath, CustomEase, ScrambleText
y TextPlugin**, cargados desde `assets/kit/lib/vendor/gsap/` (nunca desde una CDN). Para otro plugin del paquete
`gsap` (Flip, CustomWiggle, CustomBounce, Physics2D…), añádelo a `scripts/vendor.sh` y ejecuta `pnpm run vendor`.

Antes de escribir a mano un efecto con nombre, mira `kit/CATALOGO.md` y `/hyperframes-registry`: muchos ya existen
(`MAFIA.frase`, `MAFIA.escribir`, `MAFIA.draw`, `MAFIA.contador`, `MAFIA.corte`…).

## Qué leer

| Necesitas | Lee |
| --- | --- |
| `to`/`from`/`fromTo`, eases, stagger, alias de transform, `svgOrigin`, rotación direccional | `references/gsap-core.md` |
| Posición en la timeline (`"<"`, `"+=0.2"`, etiquetas), anidar, `defaults` | `references/gsap-timeline.md` |
| SplitText, MorphSVG, DrawSVG, MotionPath, ScrambleText, CustomEase | `references/gsap-plugins.md` (secciones Text, SVG y Easing) |
| `mapRange`, `clamp`, `interpolate`, `snap`, `wrap`, `distribute`, `splitColor` | `references/gsap-utils.md` (no `random`/`shuffle`: ver arriba) |

Lee solo la sección que necesites; las referencias son largas.
