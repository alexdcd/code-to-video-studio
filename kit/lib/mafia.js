/* =====================================================================
   kit/lib/mafia.js · Reusable deterministic helpers for Code to Video Studio
   ---------------------------------------------------------------------
   Carga: vendor/gsap/gsap.min.js (+ plugins) y después este fichero
          (en los proyectos va empaquetado en assets/kit/dist/mafia-kit.js). Expone window.MAFIA
          (plus the legacy window.MUS alias).

   Reglas: todo determinista (azar con semilla), todo sobre una
   timeline de GSAP pausada que pasas como `tl`, tiempos en segundos
   locales a la composición en la que llamas al helper.
   Catálogo completo con parámetros: kit/CATALOGO.md
   ===================================================================== */
(function () {
  "use strict";
  const SVGNS = "http://www.w3.org/2000/svg";

  // Plugins de GSAP: se registran si están cargados.
  const plugins = ["DrawSVGPlugin", "MorphSVGPlugin", "SplitText", "MotionPathPlugin", "CustomEase", "ScrambleTextPlugin", "TextPlugin"]
    .map((n) => window[n])
    .filter(Boolean);
  if (plugins.length) gsap.registerPlugin(...plugins);

  // Plugin interno: llama a fn(progreso) en CADA render del tween, también al buscar
  // (seek) hacia atrás o saltando. Es la forma segura de dibujar en canvas o escribir
  // texto calculado: no depende de callbacks que el seek pueda suprimir.
  gsap.registerPlugin({
    name: "mafiaCuadro",
    rawVars: 1, // sin esto GSAP ejecuta las funciones del valor («valores basados en función»)
    init(target, v) {
      this.fn = v.fn;
    },
    render(ratio, data) {
      data.fn(ratio);
    },
  });

  const M = {
    version: "0.1.0",

    /* ------------------------------------------------------------------
       Azar determinista
       ------------------------------------------------------------------ */
    /** Generador con semilla (mulberry32): const r = MAFIA.rand(7); r() → [0,1) */
    rand(seed) {
      let s = seed >>> 0;
      return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    /** Número de repeticiones finito para llenar `total` s con ciclos de `ciclo` s. */
    ciclos(total, ciclo) {
      return Math.max(0, Math.floor(total / ciclo) - 1);
    },

    /* ------------------------------------------------------------------
       Nodos
       ------------------------------------------------------------------ */
    /** Crea un nodo SVG: MAFIA.el("circle", {cx, cy, r, class}, padre) */
    el(tag, attrs, parent) {
      const e = document.createElementNS(SVGNS, tag);
      Object.entries(attrs || {}).forEach(([k, v]) => (k === "text" ? (e.textContent = v) : e.setAttribute(k, v)));
      if (parent) parent.appendChild(e);
      return e;
    },
    /** Crea un nodo HTML: MAFIA.html("div", {class: "x", text: "hola", style: "…"}, padre) */
    html(tag, attrs, parent) {
      const e = document.createElement(tag);
      Object.entries(attrs || {}).forEach(([k, v]) => {
        if (k === "text") e.textContent = v;
        else if (k === "html") e.innerHTML = v;
        else e.setAttribute(k, v);
      });
      if (parent) parent.appendChild(e);
      return e;
    },
    /** Resuelve un selector o devuelve el elemento. */
    $(x, raiz) {
      return typeof x === "string" ? (raiz || document).querySelector(x) : x;
    },

    /* ------------------------------------------------------------------
       Animación básica (migrada de MUS)
       ------------------------------------------------------------------ */
    /** Dibuja trazos (cualquier forma SVG con stroke) con stroke-dash. */
    draw(tl, targets, at, dur = 1, stagger = 0.04, ease = "power2.inOut") {
      const els = gsap.utils.toArray(targets);
      if (!els.length) return;
      els.forEach((el) => {
        el.setAttribute("pathLength", "1");
        el.style.strokeDasharray = "1 1.02";
      });
      tl.fromTo(els, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: dur, stagger, ease }, at);
    },
    /** Aparición con rebote. */
    pop(tl, targets, at, dur = 0.35, stagger = 0.03) {
      tl.fromTo(targets, { opacity: 0, scale: 0.4, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: dur, stagger, ease: "back.out(2.2)" }, at);
    },
    /** Fundido de entrada. */
    fade(tl, targets, at, dur = 0.4, stagger = 0) {
      tl.fromTo(targets, { opacity: 0 }, { opacity: 1, duration: dur, stagger, ease: "power1.out" }, at);
    },
    /** Push-in de cámara lento durante toda la escena (desde t=0). */
    push(tl, el, dur, from = 1, to = 1.06, x0 = 0, x1 = 0) {
      tl.fromTo(el, { scale: from, x: x0 }, { scale: to, x: x1, duration: dur, ease: "none" }, 0);
    },
    /** Anima un bloque .ttl (.l1 / .l2 con .kw / .meta) con desenfoque y aberración. */
    title(tl, root, at = 0.1, gap = 0.5) {
      root = M.$(root);
      const l1 = root.querySelector(".l1");
      const l2 = root.querySelector(".l2");
      const meta = root.querySelector(".meta");
      const box = root.querySelector(".ttl");
      const origin = box && box.classList.contains("center") ? "50% 50%" : box && box.classList.contains("right") ? "100% 50%" : "0% 50%";
      // Las capas globales (viñeta, grano) quedan encima del título a propósito: es transparente en el centro.
      [l1, l2, meta].forEach((e) => e && e.setAttribute("data-layout-allow-occlusion", ""));
      if (l1) tl.fromTo(l1, { opacity: 0, y: 26, scale: 1.12, transformOrigin: origin, filter: "blur(14px)" }, { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.75, ease: "expo.out" }, at);
      if (l2) {
        const t2 = l1 ? at + gap : at;
        tl.fromTo(l2, { opacity: 0, scale: 1.18, filter: "blur(18px)", transformOrigin: origin }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.55, ease: "expo.out" }, t2);
        const kws = l2.querySelectorAll(".kw");
        if (kws.length) tl.fromTo(kws, { textShadow: M.SPLIT(16) }, { textShadow: M.SPLIT(0), duration: 0.45, ease: "power2.out" }, t2);
      }
      if (meta) tl.fromTo(meta, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.6, ease: "power3.out" }, at + gap + 0.35);
    },
    /** text-shadow de aberración cromática con separación `px` (0 = limpio). */
    SPLIT(px, alpha = 0.75) {
      return `${-px}px 0 rgba(255,30,30,${px ? alpha : 0}), ${px}px 0 rgba(30,220,255,${px ? alpha : 0})`;
    },

    /* ------------------------------------------------------------------
       Dibujo técnico (migrado de MUS)
       ------------------------------------------------------------------ */
    /** Dial astronómico: anillos, marcas de grado, cruz y etiquetas. */
    dial(parent, cx, cy, r, opt = {}) {
      const g = M.el("g", { class: opt.cls || "thin" }, parent);
      (opt.rings || [1, 0.86]).forEach((k) => M.el("circle", { cx, cy, r: r * k }, g));
      const n = opt.ticks || 72;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const long = i % (opt.major || 6) === 0;
        const r1 = r * (long ? 0.9 : 0.95);
        M.el("line", { x1: cx + Math.cos(a) * r1, y1: cy + Math.sin(a) * r1, x2: cx + Math.cos(a) * r, y2: cy + Math.sin(a) * r }, g);
      }
      if (opt.cross) {
        M.el("line", { x1: cx - r * 1.15, y1: cy, x2: cx + r * 1.15, y2: cy }, g);
        M.el("line", { x1: cx, y1: cy - r * 1.15, x2: cx, y2: cy + r * 1.15 }, g);
      }
      if (opt.labels) {
        const lg = M.el("g", {}, parent);
        opt.labels.forEach((txt, i) => {
          const a = (i / opt.labels.length) * Math.PI * 2 - Math.PI / 2;
          M.el("text", { x: cx + Math.cos(a) * r * 1.09, y: cy + Math.sin(a) * r * 1.09 + 5, class: "lbl", "text-anchor": "middle", text: txt }, lg);
        });
      }
      return g;
    },
    /** Cota de plano: línea con topes y rótulo centrado. */
    dim(parent, x1, y1, x2, y2, label, cls = "thin") {
      const g = M.el("g", { class: cls }, parent);
      M.el("line", { x1, y1, x2, y2 }, g);
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = (-dy / L) * 10, ny = (dx / L) * 10;
      M.el("line", { x1: x1 - nx, y1: y1 - ny, x2: x1 + nx, y2: y1 + ny }, g);
      M.el("line", { x1: x2 - nx, y1: y2 - ny, x2: x2 + nx, y2: y2 + ny }, g);
      const t = M.el("text", { x: (x1 + x2) / 2 + nx * 1.8, y: (y1 + y2) / 2 + ny * 1.8 + 5, class: "lbl", "text-anchor": "middle", text: label }, parent);
      return [g, t];
    },

    /* ------------------------------------------------------------------
       Tiempo y cuadros
       ------------------------------------------------------------------ */
    /** Llama a fn(progreso 0→1) en cada render entre `at` y `at+dur`. Seek-safe.
        Úsalo para canvas, texto calculado o cualquier estado que dependa del tiempo. */
    porCuadro(tl, at, dur, fn, ease = "none", inicial = true) {
      if (inicial) fn(0);
      tl.to({}, { mafiaCuadro: { fn }, duration: dur, ease }, at);
    },

    /* ------------------------------------------------------------------
       Números en formato español
       ------------------------------------------------------------------ */
    /** 1234567.8 → "1.234.567,8". opts: {decimales, prefijo, sufijo, miles4 (agrupa 4 cifras: 2.500)} */
    numero(n, opts = {}) {
      const dec = opts.decimales ?? 0;
      const neg = n < 0;
      let [ent, frac] = Math.abs(n).toFixed(dec).split(".");
      if (ent.length > 4 || (opts.miles4 !== false && ent.length === 4)) ent = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      return (neg ? "−" : "") + (opts.prefijo || "") + ent + (frac ? "," + frac : "") + (opts.sufijo || "");
    },
    /** Contador que sube escribiendo el número formateado en `el`.
        opts: {desde=0, hasta, at=0, dur=1.2, ease="power2.out", decimales, prefijo, sufijo, miles4} */
    contador(tl, el, opts) {
      el = M.$(el);
      const o = Object.assign({ desde: 0, at: 0, dur: 1.2, ease: "power2.out" }, opts);
      M.porCuadro(tl, o.at, o.dur, (p) => (el.textContent = M.numero(o.desde + (o.hasta - o.desde) * p, o)), o.ease);
    },
    /** Escribe `texto` letra a letra en `el` (máquina de escribir) con cursor opcional. */
    escribir(tl, el, texto, at, opts = {}) {
      el = M.$(el);
      const cps = opts.cps || 22;
      const cursor = opts.cursor === false ? "" : opts.cursor || "▌";
      const dur = texto.length / cps;
      M.porCuadro(tl, at, dur, (p) => {
        const n = Math.round(p * texto.length);
        el.textContent = texto.slice(0, n) + (p < 1 || opts.cursorFinal ? cursor : "");
      });
      return at + dur;
    },

    /* ------------------------------------------------------------------
       Frase que se construye palabra a palabra
       ------------------------------------------------------------------ */
    /** Construye una frase en `contenedor` y la anima por golpes.
        texto: "Luego construimos / la *perfección*."   ( / = salto de línea, *…* = palabra clave,
               | = nuevo golpe: lo que va detrás aparece en el siguiente tiempo de `golpes`)
        opts: {at=0, golpes=[0, 0.9, 1.8…], escalonado=0.07, salida (s, opcional), clase}
        Devuelve {raiz, palabras, lineas}. */
    frase(tl, contenedor, texto, opts = {}) {
      contenedor = M.$(contenedor);
      const at = opts.at || 0;
      const golpes = opts.golpes || [0, 0.9, 1.8, 2.7, 3.6];
      const esc = opts.escalonado ?? 0.07;
      const raiz = M.html("div", { class: "mf-frase " + (opts.clase || "") }, contenedor);
      const palabras = [];
      const lineas = [];
      let golpe = 0;
      texto.split(/\s*\/\s*/).forEach((txtLinea, li) => {
        const linea = M.html("div", { class: `mf-linea mf-l${li + 1}` }, raiz);
        lineas.push(linea);
        let clave = false;
        txtLinea.split(/\s+/).filter(Boolean).forEach((tok) => {
          if (tok === "|") {
            golpe++;
            return;
          }
          if (tok.startsWith("|")) {
            golpe++;
            tok = tok.slice(1);
          }
          const abre = tok.startsWith("*");
          const cierra = /\*[.,;:!?…»)]*$/.test(tok);
          if (abre) clave = true;
          const limpio = tok.replace(/\*/g, "");
          if (linea.childNodes.length) linea.appendChild(document.createTextNode(" "));
          const s = M.html("span", { class: "mf-pal" + (clave ? " mf-clave" : ""), text: limpio }, linea);
          palabras.push({ el: s, golpe, clave });
          if (cierra) clave = false;
        });
      });
      const porGolpe = {};
      palabras.forEach((p) => (porGolpe[p.golpe] = porGolpe[p.golpe] || []).push(p));
      Object.entries(porGolpe).forEach(([g, lista]) => {
        const t0 = at + (golpes[g] ?? golpes[golpes.length - 1] + (g - golpes.length + 1) * 0.9);
        lista.forEach((p, i) => {
          const t = t0 + i * esc;
          if (p.clave) {
            tl.fromTo(p.el, { opacity: 0, scale: 1.35, filter: "blur(16px)", textShadow: M.SPLIT(14) }, { opacity: 1, scale: 1, filter: "blur(0px)", textShadow: M.SPLIT(0), duration: 0.55, ease: "expo.out" }, t);
          } else {
            tl.fromTo(p.el, { opacity: 0, y: 14, scale: 1.08, filter: "blur(10px)" }, { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.45, ease: "expo.out" }, t);
          }
        });
      });
      if (opts.salida != null) {
        tl.to(raiz, { opacity: 0, filter: "blur(12px)", scale: 0.97, duration: 0.35, ease: "power2.in" }, at + opts.salida);
      }
      return { raiz, palabras, lineas };
    },

    /* ------------------------------------------------------------------
       Visual layers and cuts
       ------------------------------------------------------------------ */
    /** Inserta (una vez) el filtro SVG de glitch + aberración cromática y devuelve sus nodos. */
    filtroGlitch() {
      if (M._glitch) return M._glitch;
      const svg = M.el("svg", { width: 0, height: 0, "aria-hidden": "true", style: "position:absolute;width:0;height:0" });
      const f = M.el("filter", { id: "mafia-glitch", x: "-2%", y: "-2%", width: "104%", height: "104%", "color-interpolation-filters": "sRGB" }, svg);
      const turb = M.el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.00001 0.045", numOctaves: 1, seed: 3, result: "ruido" }, f);
      // Canal G fijo a 0,5 para que el desplazamiento sea solo horizontal.
      M.el("feColorMatrix", { in: "ruido", type: "matrix", values: "1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 0 1", result: "mapa" }, f);
      const disp = M.el("feDisplacementMap", { in: "SourceGraphic", in2: "mapa", scale: 0, xChannelSelector: "R", yChannelSelector: "G", result: "roto" }, f);
      M.el("feColorMatrix", { in: "roto", type: "matrix", values: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0", result: "r" }, f);
      const offR = M.el("feOffset", { in: "r", dx: 0, dy: 0, result: "r2" }, f);
      M.el("feColorMatrix", { in: "roto", type: "matrix", values: "0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0", result: "gb" }, f);
      const offGB = M.el("feOffset", { in: "gb", dx: 0, dy: 0, result: "gb2" }, f);
      M.el("feBlend", { in: "r2", in2: "gb2", mode: "screen" }, f);
      document.body.appendChild(svg);
      M._glitch = { turb, disp, offR, offGB };
      return M._glitch;
    },

    /** Creates fixed visual layers inside `root` y las anima durante `dur` s.
        opts: {brillo, grano, vineta, marco ("completo"|"esquinas"|false), flash, semilla}
        Devuelve {flash, grano, vineta, marco, brillo}. */
    capas(tl, root, dur, opts = {}) {
      root = M.$(root);
      // Capas decorativas: se marcan para que el auditor de layout no las cuente como texto tapado.
      const capa = (clase) => M.html("div", { class: clase, "data-layout-ignore": "" }, root);
      const o = Object.assign({ brillo: true, grano: true, vineta: true, marco: "completo", flash: true, semilla: 7 }, opts);
      const out = {};
      if (o.brillo) {
        out.brillo = capa("mf-brillo");
        tl.fromTo(out.brillo, { x: -120, y: 40 }, { x: 160, y: -160, duration: dur, ease: "sine.inOut" }, 0);
      }
      // Viñeta: pseudo-elemento del contenedor de escenas (opts.vineta = selector) o capa propia (true).
      if (o.vineta && o.vineta !== true) {
        out.vineta = M.$(o.vineta);
        out.vineta.classList.add("mf-con-vineta");
      } else if (o.vineta) out.vineta = capa("mf-vineta");
      if (o.grano) {
        out.grano = capa("mf-grano");
        // El grano salta de posición 15 veces por segundo.
        tl.fromTo(out.grano, { x: 0, y: 0 }, { x: 256 * 37, y: 256 * 23, duration: dur, ease: `steps(${Math.round(dur * 15)})` }, 0);
      }
      if (o.flash) out.flash = capa("mf-flash");
      if (o.marco === "esquinas") {
        out.marco = capa("mf-esquinas");
        ["tl", "tr", "bl", "br"].forEach((c) => M.html("i", { class: "mf-esq mf-esq-" + c }, out.marco));
      } else if (o.marco) out.marco = capa("mf-marco");
      return out;
    },

    /** Corte entre escenas en el segundo `t`.
        tipo: "suave" (flash leve), "normal" (flash + empuje), "grande" (flash fuerte + aberración),
              "glitch" (desplazamiento horizontal + separación RGB + flash).
        opts: {objetivo = "#escenas", flash = ".mf-flash", semilla} */
    corte(tl, t, tipo = "normal", opts = {}) {
      // Los efectos arrancan un fotograma después del corte: el primer fotograma de la escena queda limpio
      // (y los auditores de contraste no lo miden deslumbrado).
      t += opts.retardo ?? 1 / 30;
      const objetivo = M.$(opts.objetivo || "#escenas");
      const flash = M.$(opts.flash || ".mf-flash");
      const P = {
        suave: { f: 0.15, fd: 0.2, s: 1.012, sd: 0.25, b: 1.1 },
        normal: { f: 0.22, fd: 0.24, s: 1.025, sd: 0.3, b: 1.2 },
        grande: { f: 0.7, fd: 0.6, s: 1.06, sd: 0.7, b: 1.45 },
        glitch: { f: 0.35, fd: 0.3, s: 1.03, sd: 0.35, b: 1.3 },
      }[tipo] || { f: 0.3, fd: 0.24, s: 1.025, sd: 0.3, b: 1.6 };
      if (flash) tl.fromTo(flash, { opacity: P.f }, { opacity: 0, duration: P.fd, ease: "power2.out", immediateRender: false }, t);
      if (!objetivo) return;
      if (tipo === "glitch" || tipo === "grande") {
        const g = M.filtroGlitch();
        const r = M.rand((opts.semilla || 11) + Math.round(t * 100));
        const dur = tipo === "glitch" ? 0.34 : 0.22;
        tl.set(objetivo, { filter: `url(#mafia-glitch) brightness(${P.b})` }, t);
        tl.to(objetivo, { filter: "url(#mafia-glitch) brightness(1)", duration: dur, ease: "power2.out" }, t);
        tl.set(objetivo, { filter: "none" }, t + dur + 0.01);
        const px = tipo === "glitch" ? 22 : 12;
        tl.fromTo(g.offR, { attr: { dx: -px } }, { attr: { dx: 0 }, duration: dur, ease: "power2.out", immediateRender: false }, t);
        tl.fromTo(g.offGB, { attr: { dx: px } }, { attr: { dx: 0 }, duration: dur, ease: "power2.out", immediateRender: false }, t);
        tl.fromTo(g.disp, { attr: { scale: tipo === "glitch" ? 140 : 40 } }, { attr: { scale: 0 }, duration: dur, ease: "steps(5)", immediateRender: false }, t);
        for (let k = 0; k < 5; k++) tl.set(g.turb, { attr: { seed: 1 + Math.floor(r() * 90) } }, t + k * (dur / 5));
        tl.fromTo(objetivo, { scale: P.s, x: tipo === "glitch" ? -18 : 0 }, { scale: 1, x: 0, duration: P.sd, ease: "expo.out", immediateRender: false }, t);
      } else {
        tl.fromTo(objetivo, { scale: P.s, filter: `brightness(${P.b}) saturate(1.3)` }, { scale: 1, filter: "brightness(1) saturate(1)", duration: P.sd, ease: "expo.out", immediateRender: false }, t);
      }
    },

    /* ------------------------------------------------------------------
       Lottie (guía: kit/lib/LOTTIE.md)
       ------------------------------------------------------------------ */
    /** Monta una animación Lottie que HyperFrames coloca en cada cuadro (adaptador nativo).
        Empieza en el inicio de la composición que contiene al contenedor; no la reproduzcas tú.
        opts: {datos (JSON ya cargado) | ruta (relativa al proyecto), bucle=false, encaje="xMidYMid meet"} */
    lottie(contenedor, opts = {}) {
      const L = window.lottie;
      if (!L) throw new Error("MAFIA.lottie: carga assets/kit/lib/vendor/lottie/lottie_svg.min.js en index.html, antes del kit");
      const el = typeof contenedor === "string" ? document.querySelector(contenedor) : contenedor;
      if (!el) throw new Error(`MAFIA.lottie: no existe el contenedor ${contenedor}`);
      if (!opts.datos === !opts.ruta) throw new Error("MAFIA.lottie: indica datos o ruta (uno de los dos)");
      return L.loadAnimation({
        container: el,
        renderer: "svg",
        loop: !!opts.bucle,
        autoplay: false,
        // lottie-web modifica el JSON que recibe: una copia por animación permite reutilizar los datos.
        animationData: opts.datos ? JSON.parse(JSON.stringify(opts.datos)) : undefined,
        path: opts.ruta,
        rendererSettings: { preserveAspectRatio: opts.encaje || "xMidYMid meet" },
      });
    },

    /** Registro de escenas del kit (kit/escenas/<nombre>/escena.js añade aquí su función). */
    escenas: {},
  };

  // English aliases for the public API. The original names stay available for compatibility.
  M.eachFrame = M.porCuadro;
  M.number = M.numero;
  M.counter = M.contador;
  M.typeText = M.escribir;
  M.phrase = M.frase;
  M.layers = M.capas;
  M.cut = M.corte;
  M.scenes = M.escenas;

  window.MAFIA = M;
  window.MUS = M; // legacy alias
})();
