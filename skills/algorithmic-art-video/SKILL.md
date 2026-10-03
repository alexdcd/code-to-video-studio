---
name: algorithmic-art-video
description: Arte generativo para vídeo (HyperFrames). El método de la skill algorithmic-art de Anthropic (filosofía algorítmica → algoritmo con semilla y parámetros) adaptado a canvas renderizado fotograma a fotograma. Úsala cuando el BRIEF pida arte generativo, flow fields, partículas, patrones orgánicos o matemáticos, fondos vivos o una dirección artística abstracta, o cuando una escena necesite un «toque artístico» hecho con código.
license: Apache-2.0 (referencia de Anthropic en references/, ver LICENSE.txt y NOTICE.md)
---

# Arte generativo para vídeo

`references/algorithmic-art.md` es la skill original de Anthropic **sin modificar** (procedencia en `UPSTREAM.json`).
Su método creativo es lo valioso; su implementación (p5.js, visor interactivo con marca Anthropic, `draw()` que
acumula entre fotogramas) no sirve para vídeo. Esta hoja es la única adaptación y **prevalece** sobre la referencia.

## Prioridad

1. Instrucciones del usuario y `BRIEF.md` del proyecto (estilo, paleta, marca y tono mandan sobre la filosofía).
2. `AGENTS.md` del repositorio («Reglas técnicas») y las skills `/hyperframes-*`.
3. Esta hoja.
4. `references/algorithmic-art.md`.

## Qué usar de la referencia

| Sección de la referencia | Uso aquí |
| --- | --- |
| ALGORITHMIC PHILOSOPHY CREATION (y ejemplos, principios) | **Sí.** Escribe la filosofía antes de programar, en el idioma del proyecto. Más corta: 2–4 párrafos bastan. |
| DEDUCING THE CONCEPTUAL SEED | **Sí.** La referencia sutil al tema del vídeo dentro del algoritmo. |
| TECHNICAL REQUIREMENTS → semilla y objeto de parámetros | **Sí**, con `MAFIA.rand` (abajo). |
| CRAFTSMANSHIP REQUIREMENTS | **Sí**: equilibrio, paleta pensada, jerarquía y reproducibilidad. |
| P5.JS IMPLEMENTATION, INTERACTIVE ARTIFACT CREATION, templates, RESOURCES | **No.** Sustituido por «Implementación en vídeo». No cargues p5.js ni copies la marca de Anthropic. |

## Implementación en vídeo

- **Dónde:** un `<canvas>` dentro de una composición de HyperFrames, del tamaño del vídeo. Redibuja cada fotograma
  desde su tiempo y parámetros, sin depender de una composición o proyecto concreto.
- **El fotograma es una función de `t`:** `MAFIA.porCuadro(tl, 0, DUR, (p) => cuadro(p * DUR))` y `cuadro(t)` limpia
  y redibuja todo. Nada se acumula entre fotogramas: el render puede saltar, repetir o ir hacia atrás.
- **Estelas y rastros:** dibuja el segmento entre la posición en `t` y en `t − Δ`, o varias muestras hacia atrás;
  no dejes que el canvas «se ensucie» frame a frame.
- **Sistemas que hay que integrar** (flow fields, física, crecimiento): simúlalos **una vez al cargar**, con paso
  fijo y semilla, guarda las posiciones en arrays tipados y en `cuadro(t)` lee el índice de `t`. Determinista y seguro
  ante saltos.
- **Azar:** `const r = MAFIA.rand(params.semilla)`; nada de `Math.random()`. El ruido (Perlin/simplex) se implementa
  con tablas generadas desde esa semilla.
- **Parámetros arriba**, en un objeto (`semilla`, cantidades, escalas, paleta…). Las variaciones son renders con otra
  `semilla`, no una interfaz: elige 3–4 semillas, saca un fotograma de cada una y que el usuario decida.
- **Música y golpes:** los acentos visuales salen de los tiempos del STORYBOARD o de `golpes.js`
  (`herramientas/musica/motor/reloj.py`), no de analizar el audio en directo.
- **Rendimiento:** canvas secundario para el halo/bloom y `Float32Array` para los datos. Si `check` agota el tiempo,
  baja la resolución del canvas de efectos, no la del principal.

## Entregables

1. `assets/arte/<nombre>-filosofia.md`: la filosofía y la semilla conceptual.
2. La composición con el algoritmo y el objeto de parámetros.
3. Fotogramas de revisión de las semillas candidatas (`--quality draft` + `ffmpeg -ss`) antes del render final.

Si el resultado define un aspecto repetible, propón convertirlo en estilo (`kit/estilos/README.md`).
