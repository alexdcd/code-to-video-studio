/* Estilo Editorial Motion: entradas, morphs y zoom-through calculados con GSAP. */
(function () {
  "use strict";
  const M = window.MAFIA;
  if (!M) throw new Error("editorial-motion.js necesita mafia-kit.js");

  const PALETA = Object.freeze({
    noche: "#0F1A3D",
    crema: "#FFF1D6",
    azul: "#3B7BFF",
    coral: "#FF6B5C",
    amarillo: "#FFC83D",
    menta: "#2EDBA8",
  });

  M.editorialMotion = {
    PALETA,

    entrar(tl, selector, at = 0, opts = {}) {
      const dur = opts.dur ?? 0.48;
      const x = opts.x ?? 0;
      const y = opts.y ?? 28;
      tl.fromTo(
        selector,
        { opacity: 0, x, y },
        { opacity: 1, x: 0, y: 0, duration: dur, ease: opts.ease ?? "power3.out", stagger: opts.stagger ?? 0 },
        at,
      );
      return at + dur;
    },

    morph(tl, selector, shape, at = 0, opts = {}) {
      const dur = opts.dur ?? 0.72;
      tl.to(selector, {
        morphSVG: { shape, shapeIndex: "auto" },
        duration: dur,
        ease: opts.ease ?? "power2.inOut",
      }, at);
      return at + dur;
    },

    zoomThrough(tl, opts = {}) {
      if (!opts.hueco) throw new Error("zoomThrough necesita el selector SVG del hueco.");
      const at = opts.at ?? 0;
      const dur = opts.dur ?? 1.15;
      const radio = opts.radio ?? 1180;
      const inicial = opts.inicial ?? 48;
      const ease = opts.ease ?? "power3.in";

      tl.fromTo(opts.hueco, { attr: { r: inicial } }, { attr: { r: radio }, duration: dur, ease }, at);
      if (opts.anillo) {
        tl.fromTo(
          opts.anillo,
          { attr: { r: inicial, "stroke-width": 18 } },
          { attr: { r: radio, "stroke-width": 4 }, duration: dur, ease },
          at,
        );
      }
      return at + dur;
    },
  };
})();
