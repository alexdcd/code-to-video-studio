/* =====================================================================
   kit/lib/fisica.js · Matter.js simulation precalculated for frame seeking
   ---------------------------------------------------------------------
   The world is stepped once, synchronously, with a fixed delta. Runtime
   queries read and interpolate saved poses; they never advance the engine.
   ===================================================================== */
(function () {
  "use strict";
  const M = window.MAFIA;
  if (!M) throw new Error("kit/lib/fisica.js necesita kit/lib/mafia.js antes");
  const MAX_PASOS = 20000;
  const MAX_CUERPOS = 100;
  const MAX_UNIONES = 200;
  const MAX_POSES = 100000;
  const MAX_TRABAJO = 1000000;

  function matterLib() {
    const Matter = window.Matter;
    if (!Matter || !Matter.Engine) {
      throw new Error("MAFIA.fisica: carga assets/kit/lib/vendor/matter/matter.min.js en index.html antes de mafia-kit.js");
    }
    return Matter;
  }

  function numero(valor, nombre, minimo = -Infinity) {
    if (!Number.isFinite(valor) || valor < minimo) throw new Error(`MAFIA.fisica: ${nombre} debe ser un número válido${Number.isFinite(minimo) ? ` mayor o igual que ${minimo}` : ""}`);
    return valor;
  }

  function interpolarAngulo(a, b, p) {
    const delta = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return a + delta * p;
  }

  function estadoCuerpo(body, config, visible) {
    const out = {
      id: config.id,
      x: body.position.x,
      y: body.position.y,
      angulo: body.angle,
      visible,
      forma: config.forma,
    };
    if (config.forma === "rect") {
      out.w = config.w;
      out.h = config.h;
    } else if (config.forma === "circulo") {
      out.r = config.r;
      out.w = config.r * 2;
      out.h = config.r * 2;
    } else {
      out.r = config.r;
      out.w = config.r * 2;
      out.h = config.r * 2;
    }
    return out;
  }

  function crearCuerpo(Matter, config) {
    const opciones = {};
    if (config.angulo !== undefined) opciones.angle = config.angulo;
    if (config.chaflan !== undefined && config.forma === "rect" && config.chaflan > 0) opciones.chamfer = { radius: config.chaflan };
    if (config.rebote !== undefined) opciones.restitution = config.rebote;
    if (config.friccion !== undefined) opciones.friction = config.friccion;
    if (config.friccionAire !== undefined) opciones.frictionAir = config.friccionAire;
    if (config.densidad !== undefined) opciones.density = config.densidad;
    if (config.estatico !== undefined) opciones.isStatic = !!config.estatico;
    let body;
    if (config.forma === "rect") body = Matter.Bodies.rectangle(config.x, config.y, config.w, config.h, opciones);
    else if (config.forma === "circulo") body = Matter.Bodies.circle(config.x, config.y, config.r, opciones);
    else if (config.forma === "poligono") body = Matter.Bodies.polygon(config.x, config.y, config.lados, config.r, opciones);
    else throw new Error(`MAFIA.fisica: forma no válida para ${config.id}: ${config.forma}`);
    const v = config.velocidad || {};
    if (!config.estatico && (v.x !== undefined || v.y !== undefined)) {
      Matter.Body.setVelocity(body, { x: v.x ?? 0, y: v.y ?? 0 });
    }
    if (!config.estatico && config.velAngular !== undefined) Matter.Body.setAngularVelocity(body, config.velAngular);
    return body;
  }

  function prepararCuerpos(cuerpos) {
    if (!Array.isArray(cuerpos)) throw new Error("MAFIA.fisica: cuerpos debe ser un array");
    const ids = new Set();
    return cuerpos.map((c, i) => {
      if (!c || typeof c !== "object" || typeof c.id !== "string" || !c.id.trim()) {
        throw new Error(`MAFIA.fisica: el cuerpo ${i + 1} necesita un id de texto no vacío`);
      }
      if (ids.has(c.id)) throw new Error(`MAFIA.fisica: id de cuerpo repetido: ${c.id}`);
      ids.add(c.id);
      const forma = c.forma;
      const base = {
        ...c,
        forma,
        x: numero(c.x, `${c.id}.x`),
        y: numero(c.y, `${c.id}.y`),
        entra: c.entra === undefined ? 0 : numero(c.entra, `${c.id}.entra`),
      };
      if (c.angulo !== undefined) numero(c.angulo, `${c.id}.angulo`);
      if (c.velAngular !== undefined) numero(c.velAngular, `${c.id}.velAngular`);
      if (c.velocidad !== undefined) {
        if (!c.velocidad || typeof c.velocidad !== "object") throw new Error(`MAFIA.fisica: ${c.id}.velocidad debe tener x e y`);
        if (c.velocidad.x !== undefined) numero(c.velocidad.x, `${c.id}.velocidad.x`);
        if (c.velocidad.y !== undefined) numero(c.velocidad.y, `${c.id}.velocidad.y`);
        base.velocidad = { x: c.velocidad.x ?? 0, y: c.velocidad.y ?? 0 };
      }
      for (const k of ["rebote", "friccion", "friccionAire", "densidad", "chaflan"]) {
        if (c[k] !== undefined) numero(c[k], `${c.id}.${k}`, 0);
      }
      if (forma === "rect") {
        base.w = numero(c.w, `${c.id}.w`, Number.MIN_VALUE);
        base.h = numero(c.h, `${c.id}.h`, Number.MIN_VALUE);
      } else if (forma === "circulo") {
        base.r = numero(c.r, `${c.id}.r`, Number.MIN_VALUE);
      } else if (forma === "poligono") {
        base.r = numero(c.r, `${c.id}.r`, Number.MIN_VALUE);
        if (!Number.isInteger(c.lados) || c.lados < 3) throw new Error(`MAFIA.fisica: ${c.id}.lados debe ser un entero mayor o igual que 3`);
      } else {
        throw new Error(`MAFIA.fisica: forma no válida para ${c.id}: ${forma}`);
      }
      return base;
    });
  }

  function prepararUniones(uniones, porId) {
    if (!Array.isArray(uniones)) throw new Error("MAFIA.fisica: uniones debe ser un array");
    return uniones.map((u, i) => {
      if (!u || typeof u !== "object" || !porId.has(u.a)) throw new Error(`MAFIA.fisica: unión ${i + 1} tiene un id a desconocido: ${u && u.a}`);
      if (u.b !== undefined && !porId.has(u.b)) throw new Error(`MAFIA.fisica: unión ${i + 1} tiene un id b desconocido: ${u.b}`);
      if (u.b !== undefined && u.punto !== undefined) throw new Error(`MAFIA.fisica: unión ${i + 1} debe indicar b o punto, no ambos`);
      if (u.b === undefined && u.punto === undefined) throw new Error(`MAFIA.fisica: unión ${i + 1} necesita b o punto`);
      if (u.punto !== undefined && (!u.punto || !Number.isFinite(u.punto.x) || !Number.isFinite(u.punto.y))) {
        throw new Error(`MAFIA.fisica: unión ${i + 1} necesita un punto fijo {x, y}`);
      }
      for (const k of ["rigidez", "longitud", "amortiguacion"]) {
        if (u[k] !== undefined) numero(u[k], `unión ${i + 1}.${k}`, 0);
      }
      return { ...u };
    });
  }

  function crearLimites(Matter, world, ancho, alto, limites) {
    if (!limites) return;
    const grosor = numero(limites.grosor ?? 200, "limites.grosor", Number.MIN_VALUE);
    const cuerpos = [];
    const fijo = { isStatic: true };
    if (limites.suelo !== false) cuerpos.push(Matter.Bodies.rectangle(ancho / 2, alto + grosor / 2, ancho + grosor * 2, grosor, fijo));
    if (limites.paredes !== false) {
      cuerpos.push(Matter.Bodies.rectangle(-grosor / 2, alto / 2, grosor, alto + grosor * 2, fijo));
      cuerpos.push(Matter.Bodies.rectangle(ancho + grosor / 2, alto / 2, grosor, alto + grosor * 2, fijo));
    }
    if (limites.techo === true) cuerpos.push(Matter.Bodies.rectangle(ancho / 2, -grosor / 2, ancho + grosor * 2, grosor, fijo));
    if (cuerpos.length) Matter.Composite.add(world, cuerpos);
  }

  const fisica = {
    /** Simula una vez con delta fijo y devuelve poses consultables por tiempo. */
    simular(config = {}) {
      const Matter = matterLib();
      const ancho = numero(config.ancho, "ancho", Number.MIN_VALUE);
      const alto = numero(config.alto, "alto", Number.MIN_VALUE);
      const duracion = numero(config.duracion, "duracion", 0);
      const fps = config.fps ?? 60;
      const subpasos = config.subpasos ?? 2;
      if (!Number.isInteger(fps) || fps < 1) throw new Error("MAFIA.fisica: fps debe ser un entero mayor que 0");
      if (!Number.isInteger(subpasos) || subpasos < 1) throw new Error("MAFIA.fisica: subpasos debe ser un entero mayor que 0");
      const presupuesto = duracion * fps * subpasos;
      const pasos = Math.ceil(presupuesto);
      if (pasos > MAX_PASOS) {
        throw new Error(`MAFIA.fisica: demasiados pasos; reduce fps o subpasos para no superar ${MAX_PASOS} pasos`);
      }
      const gravedad = config.gravedad ?? 1;
      numero(gravedad, "gravedad");
      const semilla = config.semilla ?? 1;
      if (!Number.isInteger(semilla) || semilla < 1) throw new Error("MAFIA.fisica: semilla debe ser un entero mayor o igual que 1");
      const limites = config.limites === undefined ? { suelo: true, paredes: true, techo: false, grosor: 200 } : config.limites;
      const cuerpos = prepararCuerpos(config.cuerpos || []);
      if (cuerpos.length > MAX_CUERPOS) {
        throw new Error(`MAFIA.fisica: demasiados cuerpos; el máximo es ${MAX_CUERPOS}`);
      }
      const porId = new Map(cuerpos.map((c) => [c.id, c]));
      const unionesEntrada = config.uniones || [];
      if (!Array.isArray(unionesEntrada)) throw new Error("MAFIA.fisica: uniones debe ser un array");
      if (unionesEntrada.length > MAX_UNIONES) {
        throw new Error(`MAFIA.fisica: demasiadas uniones; el máximo es ${MAX_UNIONES}`);
      }
      const uniones = prepararUniones(unionesEntrada, porId);
      const fotogramasGuardados = Math.ceil(pasos / subpasos) + 1;
      const posesEstimadas = cuerpos.length * fotogramasGuardados;
      if (posesEstimadas > MAX_POSES) {
        throw new Error(`MAFIA.fisica: demasiadas poses precalculadas (${posesEstimadas}); el máximo es ${MAX_POSES}; reduce cuerpos o duración`);
      }
      const paresCandidatos = (cuerpos.length * (cuerpos.length - 1)) / 2;
      const trabajoEstimado = pasos * Math.max(1, cuerpos.length + uniones.length + paresCandidatos);
      if (trabajoEstimado > MAX_TRABAJO) {
        throw new Error(`MAFIA.fisica: preparación demasiado costosa (${trabajoEstimado} unidades estimadas); el máximo es ${MAX_TRABAJO}; reduce cuerpos, uniones, fps o subpasos`);
      }

      const semillaAnterior = Matter.Common._seed;
      const idAnterior = Matter.Common._nextId;
      Matter.Common._seed = semilla;
      Matter.Common._nextId = 0;
      try {
        const engine = Matter.Engine.create({ gravity: { x: 0, y: gravedad }, enableSleeping: false });
        crearLimites(Matter, engine.world, ancho, alto, limites);
        const cuerposMatter = new Map();
        for (const c of cuerpos) cuerposMatter.set(c.id, crearCuerpo(Matter, c));
        const unionesMatter = uniones.map((u) => {
          const opciones = {
            bodyA: cuerposMatter.get(u.a),
            stiffness: u.rigidez ?? 0.7,
          };
          if (u.b !== undefined) opciones.bodyB = cuerposMatter.get(u.b);
          else opciones.pointB = { x: u.punto.x, y: u.punto.y };
          if (u.longitud !== undefined) opciones.length = u.longitud;
          if (u.amortiguacion !== undefined) opciones.damping = u.amortiguacion;
          return { config: u, matter: Matter.Constraint.create(opciones), idB: u.b };
        });
        const activos = new Set();
        const unionesActivas = new Set();
        const snapshots = [];
        const capturar = (t) => snapshots.push({
          t,
          poses: cuerpos.map((c) => {
            const body = cuerposMatter.get(c.id);
            const activo = activos.has(c.id);
            return { id: c.id, x: body.position.x, y: body.position.y, angulo: body.angle, visible: activo };
          }),
        });
        const incorporar = (t) => {
          for (const c of cuerpos) {
            if (!activos.has(c.id) && t >= c.entra) {
              Matter.Composite.add(engine.world, cuerposMatter.get(c.id));
              activos.add(c.id);
            }
          }
          for (let i = 0; i < unionesMatter.length; i++) {
            const u = unionesMatter[i];
            if (!unionesActivas.has(i) && activos.has(u.config.a) && (u.idB === undefined || activos.has(u.idB))) {
              Matter.Composite.add(engine.world, u.matter);
              unionesActivas.add(i);
            }
          }
        };

        incorporar(0);
        capturar(0);
        const deltaMs = 1000 / (fps * subpasos);
        const deltaS = 1 / (fps * subpasos);
        for (let paso = 1; paso <= pasos; paso++) {
          const t = paso * deltaS;
          incorporar(t);
          Matter.Engine.update(engine, deltaMs);
          if (paso % subpasos === 0 || paso === pasos) capturar(t);
        }

        const buscarPose = (id, tiempo) => {
          const c = porId.get(id);
          if (!c) throw new Error(`MAFIA.fisica.pose: id desconocido: ${id}`);
          if (!Number.isFinite(tiempo)) throw new Error("MAFIA.fisica.pose: t debe ser numérico");
          const t = Math.max(0, Math.min(duracion, tiempo));
          if (t < c.entra) return { x: c.x, y: c.y, angulo: c.angulo || 0, visible: false };
          let lo = 0, hi = snapshots.length - 1;
          while (lo < hi) {
            const mid = Math.floor((lo + hi) / 2);
            if (snapshots[mid].t < t) lo = mid + 1;
            else hi = mid;
          }
          const b = snapshots[lo];
          if (lo === 0 || b.t === t) {
            const p = b.poses.find((x) => x.id === id);
            return { x: p.x, y: p.y, angulo: p.angulo, visible: t >= c.entra };
          }
          const a = snapshots[lo - 1];
          const pa = a.poses.find((x) => x.id === id);
          const pb = b.poses.find((x) => x.id === id);
          const p = (t - a.t) / (b.t - a.t);
          return {
            x: pa.x + (pb.x - pa.x) * p,
            y: pa.y + (pb.y - pa.y) * p,
            angulo: interpolarAngulo(pa.angulo, pb.angulo, p),
            visible: t >= c.entra,
          };
        };

        const sim = {
          duracion,
          duration: duracion,
          pose: buscarPose,
          estado(t) {
            return cuerpos.map((c) => {
              const p = buscarPose(c.id, t);
              const body = { position: { x: p.x, y: p.y }, angle: p.angulo };
              return estadoCuerpo(body, c, p.visible);
            });
          },
          aplicar(tl, { at = 0, dur = duracion, elementos = {} } = {}) {
            if (!Number.isFinite(at) || !Number.isFinite(dur) || dur < 0) throw new Error("MAFIA.fisica.aplicar: at y dur deben ser números válidos");
            const objetivos = Object.entries(elementos).map(([id, selector]) => {
              const c = porId.get(id);
              if (!c) throw new Error(`MAFIA.fisica.aplicar: id desconocido: ${id}`);
              const el = M.$(selector);
              if (!el) throw new Error(`MAFIA.fisica.aplicar: no existe el elemento de ${id}`);
              return { id, c, el };
            });
            M.porCuadro(tl, at, dur, (p) => {
              const t = p * duracion;
              for (const { id, c, el } of objetivos) {
                const pose = buscarPose(id, t);
                const w = c.forma === "rect" ? c.w : c.r * 2;
                const h = c.forma === "rect" ? c.h : c.r * 2;
                gsap.set(el, {
                  x: pose.x - w / 2,
                  y: pose.y - h / 2,
                  rotation: (pose.angulo * 180) / Math.PI,
                  autoAlpha: pose.visible ? 1 : 0,
                });
              }
            }, "none");
            return sim;
          },
        };
        sim.state = sim.estado;
        sim.apply = sim.aplicar;
        return sim;
      } finally {
        Matter.Common._seed = semillaAnterior;
        Matter.Common._nextId = idAnterior;
      }
    },
  };

  fisica.simulate = fisica.simular;
  M.fisica = fisica;
  M.physics = fisica;
})();
