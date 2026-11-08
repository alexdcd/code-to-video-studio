# Cuaderno Vibrante

Una gramática de dibujo a mano para vídeo vertical: papel con grano procedural, tinta con un segundo trazo ligeramente desplazado, geometría simple, cámara con zoom y movimientos a 12 dibujos por segundo. La adaptación pública usa formas abstractas; no depende de personajes, marcas, narración ni assets externos.

## Uso

1. Crea un proyecto: `pnpm run new cuaderno-vibrante-9x16 mi-video`.
2. Lee el brief y adapta las escenas de `compositions/`; el template también sirve como ejemplo mínimo ejecutable.
3. Para cada frame, calcula el estado desde el tiempo del timeline. Llama a `C.setFrame(t)` antes de dibujar para fijar la vibración en pasos deterministas de 1/12 s.
4. Usa `fondo` antes de aplicar cámara, y `poligono`, `linea` o `elipse` dentro del lienzo de cámara. Reserva `subtitulo` para contenido que aporte a la voz.
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
  C.aplicarCamara(ctx, C.camara(t, { zoomInicial: 1.02, zoomFinal: 1.06 }));
  C.poligono(ctx, [[280,700],[540,580],[800,700],[700,980],[380,980]], {
    fill: C.PALETA.coral, stroke: C.PALETA.ink, seed: 41,
  });
  C.texto(ctx, "UNA IDEA", 540, 1180, 92, C.PALETA.ink);
  ctx.restore();
});
window.__timelines.s01 = tl;
```

`crearSubs(voz, { ocultar })` acepta líneas con `inicio`, `fin` y palabras `{ t, i, f }`; `ocultar` es una lista de intervalos donde la imagen ya expresa el mismo contenido. El estilo no genera ni presupone voz. `sonido.mjs` genera una cama breve de notas y golpes de papel sin muestras externas; úsala o sustitúyela según el brief.

## Dirección

- Una lectura principal por escena; las marcas de lápiz sirven a la explicación.
- Vibra el trazo, no el texto de lectura: conserva quietos los titulares y subtítulos.
- Alterna crema, tinta y acentos coral, azul, amarillo o verde sin llenar cada plano.
- Mantén los subtítulos dentro del 80 % central y separa la voz de los rótulos equivalentes.
- Usa cortes, fundidos o barridos la mayoría de las veces. Reserva brocha, iris, estrella, teselas y persiana para cambios con significado.
- Fija semillas y deriva cada movimiento del tiempo. No uses relojes de pared ni estados acumulados.

## Dependencias y licencia

No usa imágenes externas, personajes, modelos ni muestras de audio. Usa el recurso de tipografía Inter incluido en `kit/fonts/` con su licencia OFL; el Studio suministra GSAP y otros plugins conforme a los avisos incluidos.
