# Guía del estilo «Editorial Motion»

> **Estado: EN USO.** Úsalo cuando el BRIEF diga `Editorial Motion` o `editorial-motion`. Las plantillas `editorial-motion-16x9` y `editorial-motion-9x16` se han comprobado con check, poses, render y revisión visual.

## Cuándo usarlo

Para explicaciones visuales breves que convierten ideas, cifras, comparaciones o procesos en una secuencia de formas legibles. Funciona con narración o solo con rótulos concisos.

No lo uses como identidad de marca, para una crónica atmosférica, para acting de personajes o para una composición abstracta conducida por música. En esos casos, elige un estilo existente que se ajuste al BRIEF.

## Lenguaje visual

1. Alterna navy `#0F1A3D` y crema `#FFF1D6` por capítulo; el cambio de fondo responde a una nueva idea.
2. Usa la paleta exacta de seis colores del frame; combina como máximo tres colores vivos en una misma lectura.
3. Inter pesada da la jerarquía: titular grande, dato muy grande, explicación breve y etiqueta pequeña.
4. Construye con círculos, rectángulos redondeados, bandas, líneas y polígonos vectoriales limpios.
5. Da profundidad 2.5D con tres o cuatro capas de movimiento relativo y formas que desbordan el encuadre.
6. Reserva el morph, squash, parallax y zoom para cambios que expliquen relación, escala o paso de una idea a otra.
7. Mantén sombras y degradados discretos; evita texturas, personajes firma y detalle ornamental.

## Usage rules

| Recurso | Regla |
| --- | --- |
| Fondo | Alterna navy y crema al cambiar de idea. El degradado navy es un halo sutil y fijo, nunca una textura. |
| Color | Los seis tokens son constantes. Usa un acento principal por lectura y no llenes todas las formas con color. |
| Tipografía | Un titular de una o dos líneas; texto corrido en frases cortas. Comprueba `text-wrap: balance` y la zona segura. En texto pequeño usa navy/crema; reserva los acentos vivos para geometría o titulares grandes. |
| Geometría | Una metáfora clara por escena. Las formas abstractas no tienen ojos ni rasgos de mascota. |
| Tarjetas y paneles | Úsalos solo para separar información relacionada. Prefiere la forma, la línea o el espacio vacío al mosaico de tarjetas. |
| Movimiento | Entrada de 0.35–0.65 s, pausa legible de 0.35–0.6 s, overshoot menor de 4%. Sin rebote repetido. |
| Profundidad | 3–4 capas; desplaza menos la capa lejana y más la cercana. Extiende las capas móviles fuera de pantalla. |
| Subtítulos | Decide sí/no en STORYBOARD. Si los rótulos ya cuentan la misma idea que la voz, deja ese tramo sin subtítulo. |

## Reglas de dirección

- Escribe primero la lectura: una conclusión por vez. El texto y la forma que la explica pueden entrar juntos; los detalles secundarios llegan después.
- El movimiento tiene que mostrar una relación: agrupar, separar, comparar, transformar, medir o revelar.
- Usa easing suave y overshoot pequeño. Un squash breve puede dar peso a una forma; la proporción horizontal/vertical debe compensarse para conservar volumen.
- En una comparación, conserva tamaño y eje para que el cambio sea lo único que compita.
- En parallax, define la dirección de cámara antes de animar las capas; su desplazamiento relativo mantiene la misma dirección.
- Deja el cierre quieto al menos medio segundo. No tapes una lectura con un golpe decorativo.

## Arquitectura y flujo

1. Crea el proyecto con `pnpm run nuevo editorial-motion-16x9 <nombre>` en el canónico o `pnpm run new editorial-motion-16x9 <nombre>` en Code to Video Studio; cambia a `editorial-motion-9x16` para vertical.
2. Lee esta guía y [FRAME.md](FRAME.md); declara `editorial-motion` en el BRIEF.
3. Construye cada escena en `compositions/`, conserva IDs con prefijo de escena y guarda los estilos/scripts de sub-composición dentro de `<template>`.
4. Usa `MAFIA.editorialMotion` para entradas, morphs SVG y zoom-through. GSAP y el kit están empaquetados localmente; el proyecto no consulta la red.
5. Revisa poses por escena con `pnpm run poses <nombre>`, comprueba los cortes del storyboard, luego ejecuta `pnpm run check <nombre>`, `pnpm run render <nombre>` y la revisión visual habitual.

## Esqueleto

```html
<div id="s02" data-composition-id="s02" data-width="1920" data-height="1080" class="em-escena em-escena--noche">
  <h2 class="em-titular">UNA IDEA <em>CAMBIA</em></h2>
  <svg id="s02-grafico" viewBox="0 0 260 260" aria-hidden="true">
    <path id="s02-forma" d="M 130 18 C 180 18 230 68 230 130 C 230 180 180 230 130 230 C 80 230 30 180 30 130 C 30 80 80 30 130 18 Z" />
  </svg>
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  const EM = MAFIA.editorialMotion;
  EM.entrar(tl, "#s02-grafico", 0.25, { dur: 0.55, y: 24 });
  EM.morph(tl, "#s02-forma", "M 130 24 C 168 68 206 106 236 130 C 206 154 168 192 130 236 C 92 192 54 154 24 130 C 54 106 92 68 130 24 Z", 0.8);
  window.__timelines["s02"] = tl;
</script>
```

## API

`MAFIA.editorialMotion`:

- `PALETA`: los seis colores base.
- `entrar(tl, selector, at, {dur, x, y, ease, stagger})`: revela uno o varios elementos con desplazamiento y easing.
- `morph(tl, selector, path, at, {dur, ease})`: interpola un SVG con el MorphSVGPlugin ya incluido por el Studio; usa paths sencillos.
- `zoomThrough(tl, {hueco, anillo, at, dur, radio, inicial, ease})`: abre el radio de un círculo dentro de una máscara SVG; coloca la escena siguiente debajo en el timeline.

El CSS define titulares, bajadas, datos, paneles, comparativas, etiquetas, pasos, paisaje por capas y cierre. No crea una clase por cada variante temática.

## Vertical (1080×1920)

La plantilla `editorial-motion-9x16` recompone la misma demo de 11,65 s para redes verticales. Pon `em-escena--vertical` en la raíz de cada escena (también en la de transición): el CSS del estilo sube los tamaños y recoloca el paisaje.

- **Zona segura del texto esencial:** x 90–990, y 200–1440. Debajo van los subtítulos y la interfaz de la plataforma; las formas pueden desbordar.
- **Apila lo que en 16:9 va en paralelo:** «antes» arriba y «después» abajo, pasos en columna, el dato con su aclaración al lado y la lista debajo. Titular de dos o tres líneas (unos 138 px).
- **Zoom-through:** abre el círculo en el centro (540, 960) con radio ≥ 1200 para cubrir la diagonal.
- **Subtítulos con voz:** `MAFIA.subs.montar(tl, "#subs", VOZ, { modo: "frase", ocultar })` en un contenedor con la clase `sub-zona` por encima de las escenas (ver `kit/lib/mafia.css`). El fondo alterna navy y crema; una caja navy se lee sobre ambos: `--sub-fondo: rgba(15,26,61,.92); --sub-relleno: .3em .65em; --sub-radio: .5em; --sub-tenue: rgba(255,241,214,.6); --sub-acento: #FFC83D`. Decide en el STORYBOARD dónde van (no duplican el rótulo).

## Trucos

- Usa paths de pocos segmentos; el plugin ajusta su topología para el morph.
- Fija colores inicial y final por significado. Si el color cambia, que refuerce el cambio de forma.
- Para parallax, usa un desplazamiento corto: una capa cercana puede moverse entre 3 y 5 veces más que la lejana.
- La transición de zoom necesita un underlay que empiece durante la máscara. No cambies el fondo a mitad de un rótulo.
- Revisa que las palabras importantes no queden detrás de formas móviles y que cada escena se entienda sin sonido.

## Técnica

- Unidad de referencia: 1920×1080 en horizontal y 1080×1920 en vertical (clase `em-escena--vertical`; ver «Vertical»).
- Anima dentro de una sola timeline GSAP pausada por escena; HyperFrames consulta el estado al tiempo local.
- Nada de `Math.random()`, relojes de pared ni bucles perpetuos. Para una variación futura, usa `MAFIA.rand` con semilla.
- No animes la clase raíz `.clip`: usa wrappers interiores. El CSS no declara `transform` sobre elementos que anime GSAP.
- Los IDs van prefijados con `s00`, `s01`, etc.; las rutas a assets son relativas al proyecto y no usan `url("../…")`.
- Las máscaras SVG y los elementos que muevas deben quedar dentro del encuadre al inicio y al final.

## Banco de pruebas para Biblioteca Motion

Biblioteca Motion es una fuente **opcional** para precisar un lenguaje de movimiento. La escena, el color, la composición, el código final y sus tiempos siguen siendo propios del estilo y del vídeo. Las fichas se consultan a demanda; no hay integración, instalación, código ni dependencia de red en el render.

Se revisaron los ejemplos del pack `motion` #009–020 de [Motion Prompt](https://showheyohtaki.github.io/motion-prompt/) y sus especificaciones en el commit `7819d3879eb7d5a1475c11c001bedffb5cab64af`. Sus demos Canvas de 539×208 y sus tiempos sirven como vocabulario, no como plantilla ni como medidas del vídeo.

| Momento de la demo | Referencia que ayudaría | Qué aportó / ¿hizo falta? | Cobertura interna |
| --- | --- | --- | --- |
| `s02`, la forma pasa de círculo a rombo redondeado | [#012 Shape morph](https://github.com/showheyohtaki/motion-prompt/blob/7819d3879eb7d5a1475c11c001bedffb5cab64af/api/v1/en/e/012.txt) | Ayudó a elegir una transformación con pausa y un remate leve; no hizo falta copiar código. | MorphSVGPlugin se incluye con el kit y GSAP gobierna el tiempo. |
| `s03`, tres planos se mueven a distinta velocidad | [#016 Parallax](https://github.com/showheyohtaki/motion-prompt/blob/7819d3879eb7d5a1475c11c001bedffb5cab64af/api/v1/en/e/016.txt) | Sirvió para concretar el escalado de movimiento de lejos a cerca. | GSAP y las capas SVG/CSS existentes cubren el efecto; no se añadió otro motor. |
| `s04`, una apertura circular revela el cierre mientras el contenido se acerca | [#020 Zoom through](https://github.com/showheyohtaki/motion-prompt/blob/7819d3879eb7d5a1475c11c001bedffb5cab64af/api/v1/en/e/020.txt) | Aclaró cómo unir cámara y paso de escena en una lectura; la máscara propia y GSAP bastaron. | El morph, el easing y el timeline son del Studio; solo el contrato visual es externo. |
| `s00`, asentamiento del titular; `s01`, el número toma peso | [#009 Easing, #010 Overshoot y #011 Squash & stretch](https://github.com/showheyohtaki/motion-prompt/tree/7819d3879eb7d5a1475c11c001bedffb5cab64af/api/v1/en/e) | Se tomó como recordatorio de variar aceleración y dar peso; se evitó un rebote de personaje o una deformación decorativa. | `GSAP` y `MAFIA.anim` cubren easing y squash deterministas. |
| Variantes de transición orgánica o partículas | [#013 Liquid motion, #015 Particles y #017–019 Transitions](https://github.com/showheyohtaki/motion-prompt/tree/7819d3879eb7d5a1475c11c001bedffb5cab64af/api/v1/en/e) | No se usaron: añadir blur, partículas o tres transiciones distintas haría más larga y menos editorial esta prueba. | El registro de HyperFrames y `MAFIA.corte` ya cubren transiciones; `MAFIA.rand` cubre partículas reproducibles si un BRIEF las justifica. |

El resultado deja una prueba real de compatibilidad: la referencia ayuda a nombrar y concretar movimientos; el Studio sigue resolviendo el montaje con recursos deterministas y locales. No se copian personajes, composiciones, código ni interfaz de Motion Prompt.
