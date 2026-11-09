# Cuaderno Vibrante

Una gramática de dibujo a mano para vídeo vertical: papel con grano procedural, tinta con un segundo trazo ligeramente desplazado, geometría simple, cámara con zoom y movimientos a 12 dibujos por segundo. La adaptación pública usa formas abstractas; no depende de personajes, marcas, narración ni assets externos.

Es el estilo de referencia para **datos, estadísticas y presentaciones**: cifras que crecen, barras que se dibujan, un círculo a mano que rodea el dato clave y una flecha que señala la conclusión. Un vídeo de Cuaderno nunca es una diapositiva con grano encima: la cámara se mueve siempre, cada dato tiene un gesto de entrada y algo vibra en cada cuadro.

## Uso

1. Crea un proyecto: `pnpm run new cuaderno-vibrante-9x16 mi-video`.
2. Lee el brief y adapta las escenas de `compositions/`; el template también sirve como ejemplo mínimo ejecutable.
3. Para cada frame, calcula el estado desde el tiempo del timeline. Llama a `C.setFrame(t)` antes de dibujar para fijar la vibración en pasos deterministas de 1/12 s.
4. Usa `fondo` antes de aplicar cámara, y `poligono`, `linea`, `elipse`, `barra`, `numero`, `destacar` o `flecha` dentro del lienzo de cámara. Reserva `subtitulo` para contenido que aporte a la voz.
5. Ejecuta `pnpm run check mi-video`, toma capturas de los cambios y revisa el MP4 y la hoja de contactos.

## API

```js
const canvas = document.querySelector("#cuaderno");
const ctx = canvas.getContext("2d");
const C = MAFIA.cuadernoVibrante({ ctx, semilla: 31 });
const tl = gsap.timeline({ paused: true });

MAFIA.porCuadro(tl, 0, 4, (p) => {
  const t = p * 4;
  C.setFrame(t);
  C.fondo(ctx, C.PALETA.papel);
  ctx.save();
  C.aplicarCamara(ctx, C.camara(t, { zoomInicial: 1.04, zoomFinal: 1.16, focoY: 900, sacudidas: [[0.3, 1.2]] }));
  C.poligono(ctx, [[280,700],[540,580],[800,700],[700,980],[380,980]], {
    fill: C.PALETA.coral, stroke: C.PALETA.tinta, seed: 41,
  });
  C.texto(ctx, "UNA IDEA", 540, 1180, 92, C.PALETA.tinta);
  ctx.restore();
});
window.__timelines.s01 = tl;
```

Primitivas de datos (todas aceptan `progress` 0–1 derivado de `t`, y `seed`):

- `barra(ctx, x, yBase, ancho, alto, { fill, progress, etiqueta })` crece desde la base y escribe la etiqueta al llegar.
- `numero(ctx, valor, x, y, size, color, { progress, decimales, prefijo, sufijo })` cuenta hasta el valor y da un pequeño pop al final.
- `destacar(ctx, cx, cy, rx, ry, { color, progress })` dibuja un círculo a mano alrededor de algo, en una vuelta y pico.
- `flecha(ctx, x1, y1, x2, y2, { color, progress })` traza la línea y abre la punta en el último tramo.
- `camaraPlanos(t, [{ t, x, y, z }, ...], { sacudidas })` encadena planos con transición suave; sirve para hacer push sobre la barra ganadora o viajar entre dos datos.

`crearSubs(voz, { ocultar })` acepta líneas con `inicio`, `fin` y palabras `{ t, i, f }`; `ocultar` es una lista de intervalos donde la imagen ya expresa el mismo contenido. El estilo no genera ni presupone voz. `sonido.mjs` genera una cama breve de notas y golpes de papel sin muestras externas; úsala o sustitúyela según el brief.

## Dirección

- Una lectura principal por escena; las marcas de lápiz sirven a la explicación.
- Vibra el trazo, no el texto de lectura: conserva quietos los titulares y subtítulos.
- Alterna crema, tinta y acentos coral, azul, amarillo o verde sin llenar cada plano.
- Mantén los subtítulos dentro del 80 % central y separa la voz de los rótulos equivalentes.
- Usa cortes, fundidos o barridos la mayoría de las veces. Reserva brocha, iris, estrella, teselas y persiana para cambios con significado.
- Fija semillas y deriva cada movimiento del tiempo. No uses relojes de pared ni estados acumulados.

## Ambición por defecto

Estas reglas valen aunque el brief no las pida. Son lo que distingue un Cuaderno de una diapositiva.

1. **La cámara nunca está quieta.** Cada escena tiene un push-in de al menos un 8 % (`zoomInicial` 1.04 → `zoomFinal` ≥ 1.14) o un viaje con `camaraPlanos`. Añade una `sacudida` corta (0.6–1.4) en cada aterrizaje de dato o de forma.
2. **Cada dato tiene un gesto.** Nada aparece ya pintado: la barra crece, el número cuenta, la línea se traza, el círculo rodea. Dura 0.5–0.9 s por elemento y encadena con stagger de 0.12–0.2 s.
3. **Un protagonista enorme.** La cifra o forma principal ocupa al menos el 40 % del ancho (número ≥ 180 px); lo secundario es un tercio o menos. Si todo mide lo mismo, no hay lectura.
4. **Hay algo vivo en cada cuadro.** Entre gesto y gesto, deriva una forma con `Math.sin(t)`, haz respirar un acento o mantén la cámara en viaje. Ningún cuadro queda estático más de 0.5 s.
5. **El color señala.** Un acento vivo por lectura (la barra ganadora en coral, el resto en tinta o gris). Lo que importa es lo único que tiene color.
6. **Las transiciones significan.** Barrido para avanzar, iris para acercarse a un detalle, brocha para cambiar de tema. No encadenes tres fundidos.

### Coreografía de un dato (receta)

```js
// t local de la escena; todo deriva de t
C.fondo(ctx, P.papel);
ctx.save();
C.aplicarCamara(ctx, C.camaraPlanos(t, [
  { t: 0,   x: 540, y: 1000, z: 1.04 },
  { t: 2.2, x: 540, y: 1000, z: 1.08 },
  { t: 3.2, x: 640, y: 1060, z: 1.14 },   // push a la barra ganadora sin recortar el titular
], { sacudidas: [[1.0, 0.9], [2.4, 1.2]] }));
C.texto(ctx, "VENTAS 2026", 540, 380, 72, P.tinta, { weight: 800 });
[["ENE", 0.45, P.gris], ["FEB", 0.62, P.gris], ["MAR", 1.0, P.coral]].forEach(([mes, v, color], i) => {
  const x = 230 + i * 240;
  C.barra(ctx, x, 1480, 150, 560 * v, { fill: color, progress: (t - 0.3 - i * 0.18) / 0.7, seed: 20 + i, etiqueta: mes });
});
C.numero(ctx, 128, 700, 680, 200, P.coral, { progress: (t - 1.5) / 0.9, sufijo: "%", seed: 30 });
C.destacar(ctx, 700, 620, 250, 140, { color: P.azul, progress: (t - 2.4) / 0.6, seed: 31 });
C.flecha(ctx, 230, 520, 430, 600, { color: P.tinta, progress: (t - 2.9) / 0.5, seed: 32 });
ctx.restore();
```

## Dependencias y licencia

No usa imágenes externas, personajes, modelos ni muestras de audio. Usa el recurso de tipografía Inter incluido en `kit/fonts/` con su licencia OFL; el Studio suministra GSAP y otros plugins conforme a los avisos incluidos.
