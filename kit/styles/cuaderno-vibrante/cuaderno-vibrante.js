/* Portable, brand-independent Cuaderno Vibrante primitives. All visible state is seeded and seek-safe. */
(function () {
  "use strict";
  const M = window.MAFIA;
  if (!M) throw new Error("cuaderno-vibrante.js needs the Studio kit");

  const PALETA = Object.freeze({
    papel: "#F4EFE3", papelClaro: "#FAF7F0", tinta: "#242633",
    coral: "#EF685D", azul: "#477BE8", amarillo: "#F0C44A", verde: "#35BE98",
    gris: "#B6AD9E", sombra: "rgba(36,38,51,.15)",
  });
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const hash = (a, b, c) => {
    const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453123;
    return v - Math.floor(v);
  };

  M.cuadernoVibrante = function createCuaderno({ ctx: initialCtx, semilla = 17, fps = 12 } = {}) {
    const W = 1080, H = 1920;
    let frame = 0;
    let pattern = null;
    const texture = document.createElement("canvas");
    texture.width = 384; texture.height = 384;
    {
      const p = texture.getContext("2d");
      const rng = M.rand(semilla + 913);
      for (let i = 0; i < 1150; i++) {
        const alpha = 0.025 + rng() * 0.065;
        p.fillStyle = `rgba(52,45,35,${alpha})`;
        const size = 0.7 + rng() * 1.8;
        p.fillRect(rng() * 384, rng() * 384, size, size);
      }
      p.strokeStyle = "rgba(52,45,35,.055)"; p.lineWidth = 1;
      for (let i = 0; i < 36; i++) {
        const x = rng() * 384, y = rng() * 384, a = rng() * Math.PI * 2, len = 4 + rng() * 18;
        p.beginPath(); p.moveTo(x, y); p.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); p.stroke();
      }
    }
    const wobble = (key, amp) => (hash(semilla + key, frame, 1) * 2 - 1) * amp;

    function setFrame(t) { frame = Math.floor(Math.max(0, t) * fps + 1e-7); return frame; }
    function fondo(ctx, color = PALETA.papel) {
      ctx.save(); ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
      if (!pattern) pattern = ctx.createPattern(texture, "repeat");
      ctx.globalAlpha = 0.42; ctx.fillStyle = pattern; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    function trazar(ctx, points, close = true) {
      ctx.beginPath();
      points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      if (close) ctx.closePath();
    }
    function poligono(ctx, points, { fill, stroke = PALETA.tinta, width = 7, amplitude = 3, seed = 0, double = true } = {}) {
      const pass = (offset, alpha, lineWidth) => {
        const pts = points.map(([x, y], i) => [x + wobble(seed + i * 2 + offset, amplitude), y + wobble(seed + i * 2 + offset + 1, amplitude)]);
        trazar(ctx, pts);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.globalAlpha *= alpha; ctx.stroke(); ctx.globalAlpha /= alpha; }
      };
      pass(0, 1, width);
      if (double && stroke) pass(181, 0.43, width * 0.62);
    }
    function linea(ctx, x1, y1, x2, y2, { color = PALETA.tinta, width = 6, progress = 1, seed = 0, double = true } = {}) {
      const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 34));
      for (let pass = 0; pass < (double ? 2 : 1); pass++) {
        const pts = [];
        for (let i = 0; i <= n; i++) {
          const u = i / n * clamp(progress);
          pts.push([x1 + (x2 - x1) * u + wobble(seed + i * 3 + pass * 90, width * 0.26 + 1), y1 + (y2 - y1) * u + wobble(seed + i * 3 + pass * 90 + 1, width * 0.26 + 1)]);
        }
        trazar(ctx, pts, false); ctx.strokeStyle = color; ctx.lineWidth = pass ? width * 0.57 : width; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.globalAlpha *= pass ? 0.45 : 1; ctx.stroke(); if (pass) ctx.globalAlpha /= 0.45;
      }
    }
    function elipse(ctx, cx, cy, rx, ry = rx, { fill, stroke = PALETA.tinta, width = 7, seed = 0 } = {}) {
      const pts = Array.from({ length: 28 }, (_, i) => {
        const a = i / 28 * Math.PI * 2;
        return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
      });
      poligono(ctx, pts, { fill, stroke, width, amplitude: 2, seed });
    }
    function texto(ctx, value, x, y, size = 64, color = PALETA.tinta, { align = "center", weight = 700, rotation = 0, seed = 0, family = "Inter, ui-sans-serif, sans-serif" } = {}) {
      ctx.save(); ctx.translate(x + wobble(seed + 81, 1.3), y + wobble(seed + 82, 1.3)); ctx.rotate(rotation + wobble(seed + 83, 0.002));
      ctx.font = `${weight} ${size}px ${family}`; ctx.textAlign = align; ctx.textBaseline = "alphabetic"; ctx.fillStyle = color; ctx.fillText(value, 0, 0); ctx.restore();
    }
    function camara(t, { focoX = W / 2, focoY = H / 2, zoomInicial = 1.02, zoomFinal = 1.06, sacudidas = [] } = {}) {
      const u = ease(clamp(t / 4));
      const shake = sacudidas.reduce((sum, [at, strength]) => sum + (t >= at ? strength * Math.exp(-(t - at) * 8) : 0), 0);
      return { x: focoX + wobble(301, shake * 3), y: focoY + wobble(302, shake * 3), z: zoomInicial + (zoomFinal - zoomInicial) * u, r: wobble(303, shake * 0.0015) };
    }
    function aplicarCamara(ctx, c = {}) {
      ctx.translate(W / 2, H / 2); ctx.rotate(c.r || 0); ctx.scale(c.z || 1, c.z || 1); ctx.translate(-(c.x ?? W / 2), -(c.y ?? H / 2));
    }
    function subtitulo(ctx, words, { y = 1630, size = 52, active = -1, hidden = false } = {}) {
      if (hidden || !words?.length) return;
      const phrase = words.map((item) => typeof item === "string" ? item : item.text).join(" ");
      ctx.save(); ctx.font = `700 ${size}px Inter, ui-sans-serif, sans-serif`;
      const widths = words.map((item) => ctx.measureText(typeof item === "string" ? item : item.text).width);
      const space = ctx.measureText(" ").width, total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
      const box = [[540 - total / 2 - 34, y - size - 22], [540 + total / 2 + 34, y - size - 22], [540 + total / 2 + 34, y + 22], [540 - total / 2 - 34, y + 22]];
      poligono(ctx, box, { fill: PALETA.tinta, stroke: PALETA.papelClaro, width: 4, amplitude: 1, seed: 444, double: false });
      let x = 540 - total / 2;
      words.forEach((item, i) => {
        const text = typeof item === "string" ? item : item.text;
        ctx.fillStyle = i === active ? PALETA.coral : PALETA.papelClaro; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.fillText(text, x, y); x += widths[i] + space;
      });
      ctx.restore();
    }
    function crearSubs(voz, { ocultar = [], y = 1630, size = 52 } = {}) {
      const grupos = [];
      for (const line of voz?.lineas || []) {
        let group = null;
        for (const word of line.palabras || []) {
          if (!group || group.palabras.length >= 3 || /[.,?!:]$/.test(group.palabras.at(-1).t)) {
            group = { ini: word.i, fin: line.fin, palabras: [] }; grupos.push(group);
          }
          group.palabras.push(word);
        }
      }
      grupos.forEach((group, i) => { if (grupos[i + 1]) group.fin = grupos[i + 1].ini; });
      return {
        grupos,
        dibujar(t, ctx = initialCtx) {
          if (!ctx || ocultar.some(([a, b]) => t >= a && t < b)) return;
          const group = grupos.find((item) => t >= item.ini && t < item.fin); if (!group) return;
          const active = group.palabras.reduce((idx, item, i) => t >= item.i ? i : idx, 0);
          subtitulo(ctx, group.palabras.map((item) => item.t), { y, size, active });
        },
      };
    }
    function transicion(ctx, tipo, u, { color = PALETA.papelClaro, seed = 91 } = {}) {
      u = clamp(u); const cover = 1 - Math.abs(u * 2 - 1);
      if (tipo === "corte" || cover <= 0) return;
      ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = PALETA.tinta;
      if (tipo === "fundido") { ctx.globalAlpha = cover; ctx.fillRect(0, 0, W, H); }
      else if (tipo === "iris") { ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.max(W, H) * cover * 1.25, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 8; ctx.stroke(); }
      else if (tipo === "barrido") {
        const edge = W * cover;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.max(0, edge - 18), 0);
        for (let y = 0; y <= H; y += 100) ctx.lineTo(edge + Math.sin((y + seed) * 0.018) * 24 + wobble(seed + y, 8), y);
        ctx.lineTo(0, H); ctx.closePath(); ctx.fill(); ctx.lineWidth = 8; ctx.stroke();
      }
      else if (tipo === "estrella") {
        const radius = Math.max(W, H) * cover * 1.5; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? radius * 0.45 : radius; i ? ctx.lineTo(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r) : ctx.moveTo(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); ctx.lineWidth = 8; ctx.stroke();
      } else if (tipo === "persiana" || tipo === "teselas") {
        const rows = tipo === "persiana" ? 9 : 10, cols = tipo === "teselas" ? 6 : 1, cellW = W / cols, cellH = H / rows;
        for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
          const delay = ((row + col) / Math.max(1, rows + cols - 2)) * 0.32;
          const p = clamp((cover - delay) / 0.68);
          if (p <= 0) continue;
          ctx.save(); ctx.translate(col * cellW + cellW / 2, row * cellH + cellH / 2); ctx.scale(p, p);
          ctx.fillRect(-cellW / 2 - 2, -cellH / 2 - 2, cellW + 4, cellH + 4); ctx.strokeRect(-cellW / 2, -cellH / 2, cellW, cellH); ctx.restore();
        }
      } else {
        const y = H * (u < 0.5 ? -0.1 + u * 1.5 : 0.65 + (u - 0.5) * 1.5);
        ctx.beginPath(); ctx.moveTo(0, y - 170);
        for (let x = 0; x <= W; x += 90) ctx.lineTo(x, y + Math.sin((x + seed) * 0.018) * 60 + wobble(seed + x, 12));
        ctx.lineTo(W, y + 230); ctx.lineTo(0, y + 230); ctx.closePath(); ctx.fill(); ctx.lineWidth = 9; ctx.stroke();
      }
      ctx.restore();
    }
    return { W, H, PALETA, setFrame, fondo, poligono, linea, elipse, texto, camara, aplicarCamara, subtitulo, crearSubs, transicion };
  };
})();
