/* =====================================================================
   kit/lib/cartoon-motion.js · Expressive deterministic motion
   ---------------------------------------------------------------------
   Ideas adapted from John Heibel / ClaudeAnimationBase
   (MIT, referencia fijada en docs/upstream/claude-animation-base.md).

   Not a renderer or a timeline: these are pure functions of time for
   complementar HyperFrames + GSAP. Úsalas desde MAFIA.porCuadro() o para
   calcular poses/props/cámaras sin depender del fotograma anterior.
   ===================================================================== */
(function () {
  "use strict";
  const M = window.MAFIA;
  if (!M) throw new Error("cartoon-motion.js necesita kit/lib/mafia.js antes");

  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const smooth = (p) => {
    p = clamp(p);
    return p * p * (3 - 2 * p);
  };
  const cubicIn = (p) => Math.pow(clamp(p), 3);
  const cubicOut = (p) => 1 - Math.pow(1 - clamp(p), 3);
  const backOut = (p, s = 1.9) => {
    p = clamp(p);
    return 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);
  };

  function seg(t, a, b) {
    if (b === a) return t >= b ? 1 : 0;
    return clamp((t - a) / (b - a));
  }

  function keyframes(t, keys, ease = smooth) {
    if (!Array.isArray(keys) || !keys.length) throw new Error("MAFIA.anim.keyframes necesita al menos una clave");
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t < keys[i][0]) {
        const [ta, va] = keys[i - 1];
        const [tb, vb] = keys[i];
        const p = ease(seg(t, ta, tb));
        if (Array.isArray(va)) return va.map((v, j) => lerp(v, vb[j], p));
        return lerp(va, vb, p);
      }
    }
    return keys[keys.length - 1][1];
  }

  // Curva monótona por claves (Fritsch–Carlson, pendientes planas en los extremos): pasa por cada clave y nunca se
  // sale del rango de las dos que une (sin rebote). Sirve para reproducir un movimiento medido de una referencia
  // (p. ej. grados por tiempo de una bisagra) sin el tropiezo de mezclar claves con un smoothstep. Garantiza que el
  // valor es monótono, no la velocidad: si las claves medidas son ruidosas, la velocidad también. Mismas claves que
  // keyframes(): [[t, valor], ...], números o arrays.
  function curva(t, keys) {
    if (!Array.isArray(keys) || !keys.length) throw new Error("MAFIA.anim.curva necesita al menos una clave");
    if (Array.isArray(keys[0][1])) return keys[0][1].map((_, j) => curva(t, keys.map(([kt, kv]) => [kt, kv[j]])));
    const n = keys.length;
    if (t <= keys[0][0] || n === 1) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    const h = [], d = [];
    for (let i = 0; i < n - 1; i++) {
      h.push(keys[i + 1][0] - keys[i][0]);
      d.push((keys[i + 1][1] - keys[i][1]) / h[i]);
    }
    const m = new Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] > 0) {
        m[i] = (3 * (h[i - 1] + h[i])) / ((2 * h[i] + h[i - 1]) / d[i - 1] + (h[i] + 2 * h[i - 1]) / d[i]);
      }
    }
    let i = 0;
    while (t >= keys[i + 1][0]) i++;
    const u = (t - keys[i][0]) / h[i], u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * keys[i][1] + (u3 - 2 * u2 + u) * h[i] * m[i]
      + (-2 * u3 + 3 * u2) * keys[i + 1][1] + (u3 - u2) * h[i] * m[i + 1];
  }

  function spring(t, t0, damping = 6, omega = 18) {
    if (t < t0) return 0;
    const age = t - t0;
    return Math.exp(-damping * age) * Math.sin(omega * age);
  }

  function ring(t, events, damping = 6, omega = 18) {
    return events.reduce((sum, ev) => sum + spring(t, ev, damping, omega), 0);
  }

  function arc(p0, p1, height, p) {
    p = clamp(p);
    return [
      lerp(p0[0], p1[0], p),
      lerp(p0[1], p1[1], p) - height * 4 * p * (1 - p),
    ];
  }

  function onTwos(t, drawingsPerSecond = 12) {
    return Math.floor(t * drawingsPerSecond + 1e-6) / drawingsPerSecond;
  }

  function beat(t, bpm = 120, offset = 0) {
    return (t - offset) / (60 / bpm);
  }

  function pulse(t, bpm = 120, offset = 0, decay = 6, subdivisions = 1) {
    const b = beat(t, bpm, offset) * subdivisions;
    const fraction = b - Math.floor(b);
    return Math.exp(-fraction * decay);
  }

  function shake(t, amount = 1, fps = 24, seed = 17) {
    const frame = Math.floor(t * fps);
    const r = M.rand((seed + Math.imul(frame + 1, 2654435761)) >>> 0);
    return [(r() * 2 - 1) * amount, (r() * 2 - 1) * amount];
  }

  // Pose normalizada para saltos cartoon: y negativa = subir; squash positivo = aplastar.
  function jump(t, start, end, height = 1) {
    if (end <= start) throw new Error("MAFIA.anim.jump: end debe ser mayor que start");
    const anticipation = Math.min(0.14, (end - start) * 0.2);
    if (t < start - anticipation) return { y: 0, squash: 0 };
    if (t < start) return { y: 0, squash: 0.18 * smooth(seg(t, start - anticipation, start)) };
    if (t < end) {
      const p = (t - start) / (end - start);
      return {
        y: -height * 4 * p * (1 - p),
        squash: -0.16 * Math.abs(1 - 2 * p),
      };
    }
    const age = t - end;
    return { y: 0, squash: 0.22 * Math.exp(-8 * age) * Math.cos(20 * age) };
  }

  // Reacción breve de sorpresa: anticipa, estira y vuelve con overshoot.
  function take(t, at, amount = 1) {
    const anticipation = 0.1;
    if (t < at - anticipation) return { y: 0, squash: 0 };
    if (t < at) return { y: 0, squash: 0.12 * amount * smooth(seg(t, at - anticipation, at)) };
    const age = t - at;
    return {
      y: -1.2 * amount * Math.exp(-7 * age) * Math.max(0, Math.cos(9 * age)),
      squash: -0.26 * amount * Math.exp(-6 * age) * Math.cos(16 * age),
    };
  }

  M.anim = {
    clamp,
    lerp,
    seg,
    ease: smooth,
    easeIn: cubicIn,
    easeOut: cubicOut,
    backOut,
    keyframes,
    curva,
    spring,
    ring,
    arc,
    onTwos,
    beat,
    pulse,
    shake,
    jump,
    take,
  };
})();
