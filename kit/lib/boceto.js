/* =====================================================================
   kit/lib/boceto.js · Rough.js adapter with explicit deterministic seeds
   ---------------------------------------------------------------------
   Rough.js is resolved only when an API method is called. Every generated
   drawing requires a positive integer `semilla`.
   ===================================================================== */
(function () {
  "use strict";
  const M = window.MAFIA;
  if (!M) throw new Error("kit/lib/boceto.js necesita kit/lib/mafia.js antes");

  const SVGNS = "http://www.w3.org/2000/svg";
  const ESTILOS_RELLENO = new Set(["hachure", "solid", "zigzag", "cross-hatch", "dashed", "zigzag-line"]);

  function roughLib() {
    const r = window.rough;
    if (!r || typeof r.generator !== "function") {
      throw new Error("MAFIA.boceto: carga assets/kit/lib/vendor/rough/rough.js en index.html antes de mafia-kit.js");
    }
    return r;
  }

  function validarSemilla(semilla) {
    if (!Number.isInteger(semilla) || semilla < 1) {
      throw new Error("MAFIA.boceto: semilla debe ser un entero mayor o igual que 1");
    }
  }

  function validarLista(lista, nombre, minimo) {
    if (!Array.isArray(lista) || lista.length < minimo || lista.some((p) => !Array.isArray(p) || p.length < 2 || !p.slice(0, 2).every(Number.isFinite))) {
      throw new Error(`MAFIA.boceto: ${nombre} necesita al menos ${minimo} puntos [x, y] válidos`);
    }
  }

  function opcionesRough(opts = {}) {
    validarSemilla(opts.semilla);
    const traducidas = {
      aspereza: "roughness",
      curvatura: "bowing",
      color: "stroke",
      grosor: "strokeWidth",
      relleno: "fill",
      estiloRelleno: "fillStyle",
      separacion: "hachureGap",
      angulo: "hachureAngle",
      grosorRelleno: "fillWeight",
      unTrazo: "disableMultiStroke",
    };
    const salida = Object.assign({}, opts.rough || {});
    for (const [origen, destino] of Object.entries(traducidas)) {
      if (opts[origen] !== undefined) salida[destino] = opts[origen];
    }
    if (salida.stroke === undefined) salida.stroke = "currentColor";
    if (salida.strokeWidth === undefined) salida.strokeWidth = 2;
    if (salida.fillStyle === "dots" || opts.estiloRelleno === "dots") {
      throw new Error('MAFIA.boceto: Rough.js fillStyle "dots" usa azar no determinista; elige otro estilo de relleno');
    }
    if (salida.fillStyle !== undefined && !ESTILOS_RELLENO.has(salida.fillStyle)) {
      throw new Error(`MAFIA.boceto: estiloRelleno no válido: ${salida.fillStyle}`);
    }
    salida.seed = opts.semilla;
    return salida;
  }

  function generar(g, forma, opciones) {
    if (!forma || typeof forma !== "object") throw new Error("MAFIA.boceto: forma debe ser un objeto con tipo y geometría");
    const n = (key) => {
      const valor = forma[key];
      if (!Number.isFinite(valor)) throw new Error(`MAFIA.boceto: ${forma.tipo} necesita un valor numérico en ${key}`);
      return valor;
    };
    switch (forma.tipo) {
      case "rect": return g.rectangle(n("x"), n("y"), n("w"), n("h"), opciones);
      case "elipse": return g.ellipse(n("cx"), n("cy"), n("w"), n("h"), opciones);
      case "circulo": return g.circle(n("cx"), n("cy"), n("d"), opciones);
      case "linea": return g.line(n("x1"), n("y1"), n("x2"), n("y2"), opciones);
      case "poligono":
        validarLista(forma.puntos, "poligono", 3);
        return g.polygon(forma.puntos, opciones);
      case "polilinea":
        validarLista(forma.puntos, "polilinea", 2);
        return g.linearPath(forma.puntos, opciones);
      case "curva":
        validarLista(forma.puntos, "curva", 2);
        return g.curve(forma.puntos, opciones);
      case "ruta":
        if (typeof forma.d !== "string" || !forma.d.trim()) throw new Error("MAFIA.boceto: ruta necesita un atributo d no vacío");
        return g.path(forma.d, opciones);
      default:
        throw new Error(`MAFIA.boceto: tipo de forma no válido: ${forma.tipo}`);
    }
  }

  function crearGrupo(contenedor, rutas) {
    const g = document.createElementNS(SVGNS, "g");
    g.setAttribute("class", "boceto");
    for (const ruta of rutas) {
      const p = document.createElementNS(SVGNS, "path");
      p.setAttribute("d", ruta.d);
      p.setAttribute("stroke", ruta.stroke || "none");
      p.setAttribute("stroke-width", String(ruta.strokeWidth ?? 2));
      p.setAttribute("fill", ruta.fill || "none");
      g.appendChild(p);
    }
    if (contenedor) contenedor.appendChild(g);
    return g;
  }

  function numeroAttr(el, nombre, defecto = 0) {
    const valor = el.getAttribute(nombre);
    if (valor == null || valor === "") return defecto;
    const n = Number(valor);
    if (!Number.isFinite(n)) throw new Error(`MAFIA.boceto.desdeSVG: ${nombre} debe ser numérico`);
    return n;
  }

  function puntosAttr(valor, nombre) {
    const nums = (valor || "").match(/[+-]?(?:\d*\.)?\d+(?:[eE][+-]?\d+)?/g) || [];
    const coords = nums.map(Number);
    if (coords.length < 4 || coords.length % 2 || coords.some((n) => !Number.isFinite(n))) {
      throw new Error(`MAFIA.boceto.desdeSVG: ${nombre} necesita pares de coordenadas numéricas`);
    }
    const puntos = [];
    for (let i = 0; i < coords.length; i += 2) puntos.push([coords[i], coords[i + 1]]);
    return puntos;
  }

  function descriptorSVG(elemento) {
    if (!elemento || typeof elemento.getAttribute !== "function") throw new Error("MAFIA.boceto.desdeSVG: indica un elemento SVG válido");
    let tipo = (elemento.localName || elemento.tagName || "").toLowerCase();
    let forma;
    switch (tipo) {
      case "rect":
        forma = { tipo: "rect", x: numeroAttr(elemento, "x"), y: numeroAttr(elemento, "y"), w: numeroAttr(elemento, "width"), h: numeroAttr(elemento, "height") };
        break;
      case "circle": {
        const r = numeroAttr(elemento, "r");
        forma = { tipo: "circulo", cx: numeroAttr(elemento, "cx"), cy: numeroAttr(elemento, "cy"), d: r * 2 };
        break;
      }
      case "ellipse":
        forma = { tipo: "elipse", cx: numeroAttr(elemento, "cx"), cy: numeroAttr(elemento, "cy"), w: numeroAttr(elemento, "rx") * 2, h: numeroAttr(elemento, "ry") * 2 };
        break;
      case "line":
        forma = { tipo: "linea", x1: numeroAttr(elemento, "x1"), y1: numeroAttr(elemento, "y1"), x2: numeroAttr(elemento, "x2"), y2: numeroAttr(elemento, "y2") };
        break;
      case "polygon":
        forma = { tipo: "poligono", puntos: puntosAttr(elemento.getAttribute("points"), "points") };
        break;
      case "polyline":
        forma = { tipo: "polilinea", puntos: puntosAttr(elemento.getAttribute("points"), "points") };
        break;
      case "path":
        forma = { tipo: "ruta", d: elemento.getAttribute("d") };
        break;
      default:
        throw new Error(`MAFIA.boceto.desdeSVG: no se admite el elemento ${tipo || "desconocido"}`);
    }
    const base = {};
    const stroke = elemento.getAttribute("stroke");
    const strokeWidth = elemento.getAttribute("stroke-width");
    const fill = elemento.getAttribute("fill");
    if (stroke != null) base.color = stroke;
    if (strokeWidth != null) base.grosor = Number(strokeWidth);
    if (fill != null && fill !== "none") base.relleno = fill;
    return { forma, base, transform: elemento.getAttribute("transform") };
  }

  function insertarTras(g, elemento) {
    const padre = elemento.parentNode;
    if (!padre) throw new Error("MAFIA.boceto.desdeSVG: el elemento debe estar dentro de un SVG");
    padre.insertBefore(g, elemento.nextSibling);
  }

  function aplicarTransformacion(g, transform) {
    if (transform) g.setAttribute("transform", transform);
  }

  function validarAnimacion(tl, dur, fps, variantes) {
    if (!tl || typeof tl.to !== "function") throw new Error("MAFIA.boceto.hervir: indica una timeline de GSAP");
    if (!Number.isFinite(dur) || dur < 0) throw new Error("MAFIA.boceto.hervir: dur debe ser un número mayor o igual que 0");
    if (!Number.isInteger(fps) || fps < 1) throw new Error("MAFIA.boceto.hervir: fps debe ser un entero mayor que 0");
    if (!Number.isInteger(variantes) || variantes < 1) throw new Error("MAFIA.boceto.hervir: variantes debe ser un entero mayor que 0");
  }

  const boceto = {
    /** Devuelve rutas SVG Rough.js sin tocar el DOM: [{d, stroke, strokeWidth, fill}]. */
    rutas(forma, opts = {}) {
      const opciones = opcionesRough(opts);
      const rough = roughLib();
      const generator = rough.generator();
      return generator.toPaths(generar(generator, forma, opciones)).map(({ d, stroke, strokeWidth, fill }) => ({ d, stroke, strokeWidth, fill }));
    },

    /** Añade un grupo boceteado a un contenedor SVG. */
    svg(contenedor, forma, opts = {}) {
      contenedor = typeof contenedor === "string" ? document.querySelector(contenedor) : contenedor;
      if (!contenedor || typeof contenedor.appendChild !== "function") throw new Error("MAFIA.boceto.svg: indica un contenedor SVG o g válido");
      return crearGrupo(contenedor, boceto.rutas(forma, opts));
    },

    /** Convierte la geometría de atributos de una forma SVG y coloca el grupo tras ella. */
    desdeSVG(elemento, opts = {}) {
      const d = descriptorSVG(elemento);
      const opciones = Object.assign({}, d.base, opts);
      delete opciones.conservar;
      const g = crearGrupo(null, boceto.rutas(d.forma, opciones));
      aplicarTransformacion(g, d.transform);
      insertarTras(g, elemento);
      if (opts.conservar !== true) elemento.style.visibility = "hidden";
      return g;
    },

    /** Crea variantes Rough.js con cambios por cuadro calculados desde el tiempo local. */
    hervir(tl, config = {}) {
      const { at = 0, dur, contenedor, elemento } = config;
      const opciones = Object.assign({}, config.opts || {});
      const variantes = config.variantes ?? 3;
      const fps = config.fps ?? 8;
      validarAnimacion(tl, dur, fps, variantes);
      let forma = config.forma;
      let baseTransform = null;
      let original = null;
      if (elemento) {
        const d = descriptorSVG(elemento);
        forma = d.forma;
        Object.assign(opciones, d.base, config.opts || {});
        baseTransform = d.transform;
        original = elemento;
      }
      const destino = contenedor || (original && original.parentNode);
      const parent = typeof destino === "string" ? document.querySelector(destino) : destino;
      if (!parent || typeof parent.appendChild !== "function") throw new Error("MAFIA.boceto.hervir: indica contenedor o elemento SVG");
      if (!forma) throw new Error("MAFIA.boceto.hervir: indica forma o elemento");
      validarSemilla(opciones.semilla);
      const grupos = [];
      for (let i = 0; i < variantes; i++) {
        const o = Object.assign({}, opciones, { semilla: opciones.semilla + i * 101 });
        const g = crearGrupo(parent, boceto.rutas(forma, o));
        aplicarTransformacion(g, baseTransform);
        if (original) insertarTras(g, original);
        g.style.visibility = i === 0 ? "visible" : "hidden";
        grupos.push(g);
      }
      if (original && opciones.conservar !== true) original.style.visibility = "hidden";
      const inicio = Number.isFinite(at) ? at : 0;
      M.porCuadro(tl, inicio, dur, (p) => {
        const t = p * dur;
        const visible = Math.floor(t * fps) % variantes;
        grupos.forEach((g, i) => { g.style.visibility = i === visible ? "visible" : "hidden"; });
      });
      return grupos;
    },

    /** Dibuja una forma Rough.js en el canvas de `ctx`, respetando su estado de transformación. */
    canvas(ctx, forma, opts = {}) {
      if (!ctx || !ctx.canvas) throw new Error("MAFIA.boceto.canvas: indica un contexto 2D de canvas");
      const opciones = opcionesRough(opts);
      const rough = roughLib();
      const renderer = rough.canvas(ctx.canvas);
      renderer.draw(generar(rough.generator(), forma, opciones));
      return renderer;
    },

    /** Semilla de una variante de boil en un instante local. */
    semillaHervida(semilla, t, { fps = 8, variantes = 3 } = {}) {
      validarSemilla(semilla);
      if (!Number.isFinite(t)) throw new Error("MAFIA.boceto.semillaHervida: t debe ser numérico");
      if (!Number.isInteger(fps) || fps < 1) throw new Error("MAFIA.boceto.semillaHervida: fps debe ser un entero mayor que 0");
      if (!Number.isInteger(variantes) || variantes < 1) throw new Error("MAFIA.boceto.semillaHervida: variantes debe ser un entero mayor que 0");
      return semilla + ((Math.floor(t * fps) % variantes) + variantes) % variantes;
    },
  };

  boceto.paths = boceto.rutas;
  boceto.fromSVG = boceto.desdeSVG;
  boceto.boil = boceto.hervir;
  boceto.boilSeed = boceto.semillaHervida;
  M.boceto = boceto;
  M.sketch = boceto;
})();
