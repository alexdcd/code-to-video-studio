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
    }
  };
})();
