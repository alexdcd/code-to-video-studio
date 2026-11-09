# Guía del estilo «Editorial Motion»

> **Estado: EN USO.** Úsalo cuando el BRIEF diga `Editorial Motion` o `editorial-motion`. Las plantillas `editorial-motion-16x9` y `editorial-motion-9x16` se han comprobado con check, poses, render y revisión visual.

## Cuándo usarlo

Para explicaciones visuales breves que convierten ideas, cifras, comparaciones o procesos en una secuencia de **ilustraciones vectoriales planas en movimiento**: objetos reconocibles, mini-mundos y datos construidos con geometría limpia. Funciona con narración o solo con rótulos concisos.

No lo uses como identidad de marca, para una crónica atmosférica, para acting de personajes o para una composición abstracta conducida por música. En esos casos, elige un estilo existente que se ajuste al BRIEF.

## Lenguaje visual

1. Alterna navy `#0F1A3D` y crema `#FFF1D6` por capítulo; el cambio de fondo responde a una nueva idea.
2. Usa la paleta exacta de seis colores del frame; combina como máximo tres colores vivos en una misma lectura.
3. Inter pesada da la jerarquía: titular grande, dato muy grande, explicación breve y etiqueta pequeña.
4. Construye **objetos y escenas reconocibles** (portátil, ciudad, cohete, planta, gráfico, reloj) con círculos, rectángulos redondeados, bandas, líneas y polígonos vectoriales limpios. Ver «Objetos y mundos».
5. Da profundidad 2.5D con tres o cuatro capas de movimiento relativo, formas que desbordan el encuadre y una cámara que empuja o se desplaza despacio.
6. Usa el morph, squash, parallax y zoom para cambios que expliquen relación, escala o paso de una idea a otra; el montaje pieza a pieza de un objeto es el gesto firma.
7. Sombra y luz son piezas planas de la paleta, no degradados; evita texturas, personajes firma y ornamento sin significado.

## Usage rules

| Recurso | Regla |
| --- | --- |
| Fondo | Alterna navy y crema al cambiar de idea. El degradado navy es un halo sutil y fijo, nunca una textura. |
| Color | Los seis tokens son constantes. Usa un acento principal por lectura y no llenes todas las formas con color. |
| Tipografía | Un titular de una o dos líneas; texto corrido en frases cortas. Comprueba `text-wrap: balance` y la zona segura. En texto pequeño usa navy/crema; reserva los acentos vivos para geometría o titulares grandes. |
| Geometría | Una metáfora clara por escena, encarnada en un objeto o mini-mundo reconocible. Las formas no tienen ojos ni rasgos de mascota, pero sí detalle funcional. |
| Cámara | Contenido dentro de `.em-camara`; `EM.camara` hace push-in o pan de 4–8 % en cada escena. Cambios de capítulo con `zoomThrough`. |
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
- Antes de dar por buena una escena, pregúntate: ¿qué objeto o mundo veo? Si la respuesta es «un círculo y un texto», no está terminada.

## Objetos y mundos (obligatorio, no opcional)

La geometría es el ladrillo, no el resultado. El estilo es ilustración vectorial plana: cada escena con metáfora contiene **al menos un objeto reconocible o un mini-mundo** construido con 6–20 piezas (`.em-objeto` > `.em-pieza`). Un círculo suelto junto a un titular no es Editorial Motion; un portátil que se abre, una ciudad que crece o un cohete que despega sí lo son.

Reglas de construcción:

- Rellenos planos de la paleta; **sin degradados ni contornos**. El volumen se da con una pieza `.em-pieza--sombra` (tono oscuro al 22 %) en la cara en sombra y, si hace falta, una `.em-pieza--luz` en la arista iluminada.
- Un `.em-suelo` elíptico bajo el objeto lo ancla en el espacio.
- El objeto **se monta en pantalla** (`EM.montar`): las piezas llegan desde fuera y encajan con stagger. Es el gesto firma del estilo. Después puede respirar (`EM.flotar`) o transformarse (`EM.morph`).
- Los objetos no tienen ojos, boca ni rasgos de mascota; sí tienen detalle funcional (teclas, ventanas, ruedas, hojas).
- El objeto ocupa al menos el 35 % del lado corto del encuadre. Lo pequeño no se ve.

Catálogo de recetas (piezas aproximadas):

| Objeto | Piezas | Movimiento natural |
| --- | --- | --- |
| Portátil | base suave, pantalla, bisel, 3–4 bloques de interfaz, sombra en la base | la pantalla se abre (rotateX desde 70°) y la interfaz entra en stagger |
| Teléfono | cuerpo suave, pantalla, notch, 3 tarjetas | tarjetas que deslizan; badge que hace pop |
| Ciudad | 5–8 rectángulos de alturas distintas, ventanas pequeñas, sol redondo | edificios crecen desde el suelo con stagger; el sol sube |
| Cohete | cuerpo suave, pico, 2 aletas rombo, llama pico coral/amarillo | despegue con `y` negativo y la llama palpita |
| Planta / crecimiento | maceta, tallo, 3–5 hojas pico rotadas | hojas se montan de abajo arriba; el tallo crece con scaleY |
| Servidor / nube | 3 bloques apilados con luces, o nube de 3–4 círculos | luces parpadean en secuencia; la nube flota |
| Reloj | círculo, 2 manecillas, 12 marcas | las manecillas giran hasta la hora clave |
| Documento | hoja suave, 4–6 líneas de texto, sello redondo | líneas aparecen en stagger; el sello cae con `montar` |
| Gráfico como objeto | 3–5 barras con pie, eje, flecha de tendencia | barras crecen; la flecha se traza al final |
| Monedas / coste | 4–6 elipses apiladas, símbolo | la pila sube moneda a moneda; la cámara hace push |
| Montañas / paisaje | 3 capas de polígonos (ya en `.em-paisaje-*`) | parallax: la capa cercana viaja 3–5× más |
| Engranajes / proceso | 2–3 círculos dentados (clip-path), eje | giran en sentidos opuestos a velocidades proporcionales |

Esqueleto de un objeto:

```html
<div class="em-camara">
  <div id="s01-portatil" class="em-objeto" style="left:1100px;top:380px;width:620px;height:420px">
    <div class="em-pieza em-pieza--suave" style="left:40px;top:0;width:540px;height:340px;background:#0F1A3D"></div>
    <div class="em-pieza" style="left:68px;top:26px;width:484px;height:288px;background:#3B7BFF"></div>
    <div class="em-pieza em-pieza--suave" style="left:110px;top:70px;width:260px;height:36px;background:#FFF1D6"></div>
    <div class="em-pieza em-pieza--suave" style="left:110px;top:130px;width:400px;height:120px;background:#FFC83D"></div>
    <div class="em-pieza em-pieza--redonda" style="left:470px;top:70px;width:40px;height:40px;background:#FF6B5C"></div>
    <div class="em-pieza em-pieza--suave" style="left:0;top:344px;width:620px;height:36px;background:#FF6B5C"></div>
    <div class="em-pieza em-pieza--sombra" style="left:0;top:368px;width:620px;height:12px"></div>
    <div class="em-suelo" style="left:-40px;top:392px;width:700px"></div>
  </div>
</div>
<script>
  EM.camara(tl, "#s01 .em-camara", { at: 0, dur: 3.2, desde: 1, hasta: 1.07, x: -30 });
  EM.montar(tl, "#s01-portatil .em-pieza", 0.3, { dur: 0.5, stagger: 0.07 });
  EM.flotar(tl, "#s01-portatil", 1.4, { y: 8, dur: 1.2 });
</script>
```

## Ambición por defecto

1. **Cámara viva en toda escena.** El contenido va dentro de `.em-camara` y `EM.camara` hace un push-in o pan lento (4–8 %) durante toda la escena; los cambios de capítulo usan `zoomThrough`. Un plano fijo es una decisión, no el valor por defecto.
2. **Contraste de escala.** El héroe (dato, titular u objeto) ocupa ≥ 40 % del ancho; lo secundario, un tercio o menos.
3. **Profundidad en tres planos.** Fondo (halo o capa lejana), objeto y primer plano (etiquetas, anotación). Al mover la cámara, cada plano se desplaza distinto.
4. **Las entradas son físicas.** `montar` para objetos, `entrar` con desplazamiento para texto, trazado para líneas. Nada aparece con un simple fade.
5. **Siempre hay algo en movimiento secundario** (flotar, girar, parpadear) mientras se lee. Ningún cuadro queda estático más de 0.5 s.

## Arquitectura y flujo

1. Crea el proyecto con `pnpm run nuevo editorial-motion-16x9 <nombre>` en el canónico o `pnpm run new editorial-motion-16x9 <nombre>` en Code to Video Studio; cambia a `editorial-motion-9x16` para vertical.
2. Lee esta guía y [FRAME.md](FRAME.md); declara `editorial-motion` en el BRIEF.
3. Construye cada escena en `compositions/`, conserva IDs con prefijo de escena y guarda los estilos/scripts de sub-composición dentro de `<template>`.
4. Usa `MAFIA.editorialMotion` para entradas, cámara, montaje de objetos, morphs SVG y zoom-through. GSAP y el kit están empaquetados localmente; el proyecto no consulta la red.
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
- `camara(tl, selector, {at, dur, desde, hasta, x, y, ease})`: push-in o pan lento sobre un wrapper `.em-camara`; por defecto escala de 1 a 1.08 en 3 s.
- `montar(tl, selector, at, {dur, stagger, distancia, escala, desde, ease})`: ensambla las piezas de un objeto llegando desde direcciones alternas y deterministas; `desde: "abajo"` las hace subir todas.
- `flotar(tl, selector, at, {dur, y, repeat})`: respiración vertical acotada para que un objeto siga vivo mientras se lee.
- `morph(tl, selector, path, at, {dur, ease})`: interpola un SVG con MorphSVGPlugin de `gsap@3.15.0`; `pnpm run setup` lo copia del paquete npm al runtime local del Studio. Usa paths sencillos.
- `zoomThrough(tl, {hueco, anillo, at, dur, radio, inicial, ease})`: abre el radio de un círculo dentro de una máscara SVG; coloca la escena siguiente debajo en el timeline.

El CSS define titulares, bajadas, datos, paneles, comparativas, etiquetas, pasos, paisaje por capas, cierre, y las piezas para objetos (`.em-camara`, `.em-objeto`, `.em-pieza` con variantes `--redonda`, `--suave`, `--pico`, `--rombo`, `--sombra`, `--luz`, y `.em-suelo`). No crea una clase por cada objeto: los objetos se componen en la escena.

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
| `s02`, la forma pasa de círculo a rombo redondeado | [#012 Shape morph](https://github.com/showheyohtaki/motion-prompt/blob/7819d3879eb7d5a1475c11c001bedffb5cab64af/api/v1/en/e/012.txt) | Ayudó a elegir una transformación con pausa y un remate leve; no hizo falta copiar código. | MorphSVGPlugin llega con `gsap@3.15.0` desde npm y setup lo copia al runtime local; GSAP gobierna el tiempo. |
| `s03`, tres planos se mueven a distinta velocidad | [#016 Parallax](https://github.com/showheyohtaki/motion-prompt/blob/7819d3879eb7d5a1475c11c001bedffb5cab64af/api/v1/en/e/016.txt) | Sirvió para concretar el escalado de movimiento de lejos a cerca. | GSAP y las capas SVG/CSS existentes cubren el efecto; no se añadió otro motor. |
| `s04`, una apertura circular revela el cierre mientras el contenido se acerca | [#020 Zoom through](https://github.com/showheyohtaki/motion-prompt/blob/7819d3879eb7d5a1475c11c001bedffb5cab64af/api/v1/en/e/020.txt) | Aclaró cómo unir cámara y paso de escena en una lectura; la máscara propia y GSAP bastaron. | El morph, el easing y el timeline son del Studio; solo el contrato visual es externo. |
| `s00`, asentamiento del titular; `s01`, el número toma peso | [#009 Easing, #010 Overshoot y #011 Squash & stretch](https://github.com/showheyohtaki/motion-prompt/tree/7819d3879eb7d5a1475c11c001bedffb5cab64af/api/v1/en/e) | Se tomó como recordatorio de variar aceleración y dar peso; se evitó un rebote de personaje o una deformación decorativa. | `GSAP` y `MAFIA.anim` cubren easing y squash deterministas. |
| Variantes de transición orgánica o partículas | [#013 Liquid motion, #015 Particles y #017–019 Transitions](https://github.com/showheyohtaki/motion-prompt/tree/7819d3879eb7d5a1475c11c001bedffb5cab64af/api/v1/en/e) | No se usaron: añadir blur, partículas o tres transiciones distintas haría más larga y menos editorial esta prueba. | El registro de HyperFrames y `MAFIA.corte` ya cubren transiciones; `MAFIA.rand` cubre partículas reproducibles si un BRIEF las justifica. |

El resultado deja una prueba real de compatibilidad: la referencia ayuda a nombrar y concretar movimientos; el Studio sigue resolviendo el montaje con recursos deterministas y locales. No se copian personajes, composiciones, código ni interfaz de Motion Prompt.
