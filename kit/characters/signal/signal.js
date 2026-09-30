(function () {
  "use strict";
  const M = window.MAFIA;
  if (!M) throw new Error("signal character requires MAFIA core");

  function insert(parent, prefix, opts = {}) {
    parent = M.$(parent);
    const size = opts.size || 260;
    const wrap = M.html("div", {
      id: prefix,
      style: `position:absolute;width:${size}px;height:${size}px;${opts.style || ""}`
    }, parent);
    const svg = M.el("svg", { viewBox: "0 0 260 260", width: "100%", height: "100%" }, wrap);
    const orbit = M.el("g", { id: prefix + "-orbit", transform: "translate(130 130)" }, svg);
    M.el("ellipse", { cx: 0, cy: 0, rx: 96, ry: 38, fill: "none", stroke: "#7ee7ff", "stroke-width": 4, opacity: .55 }, orbit);
    M.el("circle", { cx: 96, cy: 0, r: 9, fill: "#7ee7ff" }, orbit);
    const core = M.el("circle", { id: prefix + "-core", cx: 130, cy: 130, r: 62, fill: "#111521", stroke: "#f7f8fb", "stroke-width": 5 }, svg);
    const eye = M.el("circle", { id: prefix + "-eye", cx: 130, cy: 126, r: 15, fill: "#7ee7ff" }, svg);
    M.el("circle", { cx: 124, cy: 120, r: 4, fill: "#f7f8fb", opacity: .9 }, svg);
    return { wrap, svg, orbit, core, eye };
  }

  function enter(tl, c, at = 0) {
    tl.fromTo(c.wrap, { opacity: 0, scale: .5, y: 80 }, { opacity: 1, scale: 1, y: 0, duration: .7, ease: "back.out(1.8)" }, at);
    tl.fromTo(c.orbit, { rotation: -80, transformOrigin: "0px 0px" }, { rotation: 0, duration: .9, ease: "expo.out" }, at);
  }

  function react(tl, c, at = 0, amount = 1) {
    tl.fromTo(c.wrap,
      { scaleX: 1 + .16 * amount, scaleY: 1 - .16 * amount, transformOrigin: "50% 50%" },
      { scaleX: 1, scaleY: 1, duration: .45, ease: "elastic.out(1,.45)", immediateRender: false }, at);
    tl.fromTo(c.eye, { attr: { r: 22 } }, { attr: { r: 15 }, duration: .4, ease: "expo.out", immediateRender: false }, at);
  }

  function orbit(tl, c, at, duration, turns = 1) {
    tl.to(c.orbit, { rotation: 360 * turns, duration, ease: "none", transformOrigin: "0px 0px" }, at);
  }

  M.signal = { insert, enter, react, orbit };
})();
