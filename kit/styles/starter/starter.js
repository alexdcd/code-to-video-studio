(function () {
  "use strict";
  const M = window.MAFIA;
  if (!M) throw new Error("starter style requires MAFIA core");

  M.starter = {
    node(parent, { x, y, title, text }) {
      const el = M.html("div", { class: "starter-node", style: `left:${x}px;top:${y}px` }, parent);
      M.html("strong", { text: title }, el);
      if (text) M.html("span", { text }, el);
      return el;
    },
    connector(svg, a, b) {
      return M.el("path", {
        d: `M ${a[0]} ${a[1]} C ${a[0]} ${(a[1]+b[1])/2}, ${b[0]} ${(a[1]+b[1])/2}, ${b[0]} ${b[1]}`,
        class: "starter-line"
      }, svg);
    },
    /* Slow push-in / drift of a `.starter-camera` wrapper across the scene. */
    camera(tl, el, { at = 0, dur = 4, from = 1, to = 1.08, x = 0, y = 0, ease = "sine.inOut" } = {}) {
      tl.fromTo(el, { scale: from, x: 0, y: 0 }, { scale: to, x, y, duration: dur, ease }, at);
      return at + dur;
    },
    /* Short camera hit on a key beat: a quick extra push that settles back. */
    punch(tl, el, at = 0, { strength = 0.035, dur = 0.5 } = {}) {
      tl.to(el, { scale: `+=${strength}`, duration: dur * 0.3, ease: "power2.out" }, at)
        .to(el, { scale: `-=${strength}`, duration: dur * 0.7, ease: "power2.inOut" }, at + dur * 0.3);
      return at + dur;
    },
    /* Bounded rotation so an orbit or ring keeps living between beats. */
    orbit(tl, el, at = 0, dur = 3, degrees = 24) {
      tl.to(el, { rotation: degrees, transformOrigin: "50% 50%", duration: dur, ease: "sine.inOut" }, at);
      return at + dur;
    }
  };
})();
