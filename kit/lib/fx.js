/* =====================================================================
   kit/lib/fx.js · Deterministic canvas effects
   ---------------------------------------------------------------------
   `pixelar` captures only decoded, same-origin images/canvases or a drawing callback.
   Video sources are rejected because their exact frame is not guaranteed.
   ===================================================================== */
(function () {
  "use strict";
  const M = window.MAFIA;
  if (!M) throw new Error("kit/lib/fx.js necesita kit/lib/mafia.js antes");
  M.fx = M.fx || {};

  function bloque(p, desde, hasta) {
    if (!Number.isFinite(p) || p < 0 || p > 1) throw new Error("MAFIA.fx.bloque: p debe estar entre 0 y 1");
    if (!Number.isFinite(desde) || desde < 1 || !Number.isFinite(hasta) || hasta < 1) {
      throw new Error("MAFIA.fx.bloque: desde y hasta deben ser números mayores o iguales que 1");
    }
    return Math.max(1, Math.round(desde + (hasta - desde) * p));
  }

  function esVideo(origen) {
    return (typeof HTMLVideoElement !== "undefined" && origen instanceof HTMLVideoElement)
      || String(origen && (origen.tagName || origen.nodeName) || "").toLowerCase() === "video";
  }

  function crearCanvas(ancho, alto) {
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    return canvas;
  }

  function comprobarLectura(ctx) {
    try {
      ctx.getImageData(0, 0, 1, 1);
    } catch (error) {
      if (error && error.name === "SecurityError") {
        throw new Error("MAFIA.fx.pixelar: el origen debe ser del mismo origen y permitir lectura de píxeles");
      }
      throw error;
    }
  }

  function comprobarOrigen(origen) {
    const prueba = crearCanvas(1, 1);
    const ctx = prueba.getContext("2d");
    if (!ctx) throw new Error("MAFIA.fx.pixelar: no se pudo crear el contexto para validar el origen");
    try {
      ctx.drawImage(origen, 0, 0, 1, 1);
      comprobarLectura(ctx);
    } catch (error) {
      if (error && error.message && error.message.includes("MAFIA.fx.pixelar:")) throw error;
      throw new Error(`MAFIA.fx.pixelar: no se pudo leer el origen: ${error.message || error}`);
    }
  }

  const fx = {
    /** Tamaño entero del bloque para un progreso de 0 a 1. */
    bloque,

    /** Pixela una imagen, canvas o dibujo funcional en una timeline seek-safe. */
    pixelar(tl, { at = 0, dur, destino, origen, desde = 1, hasta = 40, ease = "none" } = {}) {
      if (!tl || typeof tl.to !== "function") throw new Error("MAFIA.fx.pixelar: indica una timeline de GSAP");
      if (!Number.isFinite(at) || !Number.isFinite(dur) || dur < 0) throw new Error("MAFIA.fx.pixelar: at y dur deben ser números válidos");
      if (!destino || typeof destino.getContext !== "function") throw new Error("MAFIA.fx.pixelar: destino debe ser un canvas");
      if (!Number.isFinite(desde) || desde < 1 || !Number.isFinite(hasta) || hasta < 1) throw new Error("MAFIA.fx.pixelar: desde y hasta deben ser números mayores o iguales que 1");
      if (esVideo(origen)) throw new Error("MAFIA.fx.pixelar: vídeo no permitido como origen; no se garantiza el cuadro exacto");

      const ancho = destino.width;
      const alto = destino.height;
      if (!ancho || !alto) throw new Error("MAFIA.fx.pixelar: destino debe tener ancho y alto mayores que 0");
      const destinoCtx = destino.getContext("2d");
      if (!destinoCtx) throw new Error("MAFIA.fx.pixelar: no se pudo crear el contexto 2D de destino");

      let fuente = origen;
      let dibujarFuente = null;
      if (typeof origen === "function") {
        const fuenteCanvas = crearCanvas(ancho, alto);
        const fuenteCtx = fuenteCanvas.getContext("2d");
        if (!fuenteCtx) throw new Error("MAFIA.fx.pixelar: no se pudo crear el contexto 2D de origen");
        fuente = fuenteCanvas;
        dibujarFuente = () => {
          fuenteCtx.clearRect(0, 0, ancho, alto);
          origen(fuenteCtx, ancho, alto);
          comprobarLectura(fuenteCtx);
        };
      } else if (esVideo(origen)) {
        throw new Error("MAFIA.fx.pixelar: vídeo no permitido como origen; no se garantiza el cuadro exacto");
      } else if (origen && typeof origen === "object" && (typeof HTMLImageElement !== "undefined" && origen instanceof HTMLImageElement || "naturalWidth" in origen)) {
        if (!origen.complete || !origen.naturalWidth) {
          throw new Error("MAFIA.fx.pixelar: la imagen debe estar decodificada antes del primer cuadro (await img.decode())");
        }
      } else if (!(origen && (typeof HTMLCanvasElement !== "undefined" && origen instanceof HTMLCanvasElement || typeof origen.getContext === "function"))) {
        throw new Error("MAFIA.fx.pixelar: origen debe ser una imagen decodificada, un canvas o una función de dibujo");
      }
      if (!dibujarFuente) comprobarOrigen(origen);

      const reducido = crearCanvas(ancho, alto);
      const reducidoCtx = reducido.getContext("2d");
      if (!reducidoCtx) throw new Error("MAFIA.fx.pixelar: no se pudo crear el contexto 2D de muestreo");
      M.porCuadro(tl, at, dur, (p) => {
        const progreso = Math.max(0, Math.min(1, p));
        const tamano = bloque(progreso, desde, hasta);
        const sw = Math.ceil(ancho / tamano);
        const sh = Math.ceil(alto / tamano);
        if (reducido.width !== sw) reducido.width = sw;
        if (reducido.height !== sh) reducido.height = sh;
        reducidoCtx.imageSmoothingEnabled = true;
        if (dibujarFuente) dibujarFuente();
        reducidoCtx.clearRect(0, 0, sw, sh);
        reducidoCtx.drawImage(fuente, 0, 0, sw, sh);
        destinoCtx.save();
        destinoCtx.setTransform(1, 0, 0, 1, 0, 0);
        destinoCtx.clearRect(0, 0, ancho, alto);
        destinoCtx.imageSmoothingEnabled = false;
        destinoCtx.drawImage(reducido, 0, 0, sw, sh, 0, 0, ancho, alto);
        destinoCtx.restore();
      }, ease);
    },
  };

  fx.pixelate = fx.pixelar;
  fx.blockSize = fx.bloque;
  M.fx = fx;
})();
