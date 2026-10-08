import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const requireHyperframes = createRequire(require.resolve("hyperframes/package.json"));
const rough = require("roughjs/bundled/rough.cjs.js");
const Matter = require("matter-js");
const puppeteer = requireHyperframes("puppeteer-core");

function cargarMAFIA({ gsap = { set() {} } } = {}) {
  const window = { MAFIA: {}, rough, Matter };
  const contexto = vm.createContext({ window, Math, console, gsap });
  for (const archivo of ["kit/lib/boceto.js", "kit/lib/fisica.js", "kit/lib/fx.js"]) {
    const codigo = fs.readFileSync(path.join(raiz, archivo), "utf8");
    vm.runInContext(codigo, contexto, { filename: archivo });
  }
  return window.MAFIA;
}

const codigoFx = fs.readFileSync(path.join(raiz, "kit/lib/fx.js"), "utf8");

test("boceto es reproducible, valida semilla y no usa Math.random", () => {
  const MAFIA = cargarMAFIA();
  const forma = { tipo: "rect", x: 12, y: 8, w: 100, h: 70 };
  assert.deepStrictEqual(MAFIA.boceto.rutas(forma, { semilla: 5 }), MAFIA.boceto.rutas(forma, { semilla: 5 }));
  assert.notDeepStrictEqual(MAFIA.boceto.rutas(forma, { semilla: 5 }), MAFIA.boceto.rutas(forma, { semilla: 6 }));
  const opcionesPorDefecto = MAFIA.boceto.rutas(forma, { semilla: 5 });
  assert.ok(opcionesPorDefecto.length > 0);
  assert.ok(opcionesPorDefecto.every((ruta) => ruta.stroke === "currentColor" && ruta.strokeWidth === 2));
  const rellenoConPatron = MAFIA.boceto.rutas(forma, {
    semilla: 5, relleno: "#dbc89d", estiloRelleno: "cross-hatch",
  });
  assert.ok(rellenoConPatron.some((ruta) => ruta.stroke === "#dbc89d" && ruta.fill === "none"),
    "el color de relleno debe teñir los trazos del patrón, no convertirse en fillStyle");
  const opcionesRough = MAFIA.boceto.rutas(forma, { semilla: 5, rough: { stroke: "#123456", strokeWidth: 4 } });
  assert.ok(opcionesRough.every((ruta) => ruta.stroke === "#123456" && ruta.strokeWidth === 4));
  assert.throws(() => MAFIA.boceto.rutas(forma), /semilla/);
  assert.throws(() => MAFIA.boceto.rutas(forma, { semilla: 0 }), /semilla/);
  assert.throws(() => MAFIA.boceto.rutas(forma, { semilla: 1.5 }), /semilla/);
  assert.throws(() => MAFIA.boceto.rutas(forma, { semilla: 5, estiloRelleno: "dots" }), /dots/);

  const formas = [
    forma,
    { tipo: "elipse", cx: 60, cy: 45, w: 70, h: 40 },
    { tipo: "circulo", cx: 60, cy: 45, d: 50 },
    { tipo: "linea", x1: 10, y1: 10, x2: 110, y2: 80 },
    { tipo: "poligono", puntos: [[10, 10], [80, 15], [50, 80]] },
    { tipo: "polilinea", puntos: [[10, 10], [50, 80], [110, 10]] },
    { tipo: "curva", puntos: [[10, 50], [45, 5], [80, 90], [110, 50]] },
    { tipo: "ruta", d: "M10 10 L110 80 L10 80 Z" },
  ];
  const estilos = ["hachure", "solid", "zigzag", "cross-hatch", "dashed", "zigzag-line"];
  const resultados = [];
  const randomOriginal = Math.random;
  try {
    Math.random = () => { throw new Error("Math.random no debe usarse"); };
    for (const f of formas) {
      for (const estiloRelleno of estilos) {
        resultados.push(MAFIA.boceto.rutas(f, { semilla: 19, relleno: "#345678", estiloRelleno }));
      }
    }
  } finally {
    Math.random = randomOriginal;
  }
  assert.equal(resultados.length, formas.length * estilos.length);
  assert.ok(resultados.every((r) => r.length > 0));
  assert.deepStrictEqual(
    [0, 1 / 8, 2 / 8, 3 / 8].map((t) => MAFIA.boceto.semillaHervida(5, t, { fps: 8, variantes: 3 })),
    [5, 6, 7, 5],
  );
});

test("fisica precalcula estados repetibles e interpola poses", () => {
  const MAFIA = cargarMAFIA();
  const config = {
    ancho: 320,
    alto: 240,
    duracion: 3,
    fps: 30,
    subpasos: 2,
    gravedad: 1,
    semilla: 7,
    limites: { suelo: true, paredes: true, techo: false, grosor: 200 },
    cuerpos: [
      { id: "c1", forma: "rect", x: 150, y: -20, w: 30, h: 30, rebote: 0, friccion: 0.4 },
      { id: "c2", forma: "circulo", x: 60, y: -25, r: 12, entra: 0.6 },
      { id: "c3", forma: "poligono", x: 250, y: -25, lados: 5, r: 16, entra: 1.1 },
    ],
  };
  const a = MAFIA.fisica.simular(config);
  const b = MAFIA.fisica.simular(config);
  for (let i = 0; i < 20; i++) {
    const t = (i / 19) * config.duracion;
    assert.deepStrictEqual(a.estado(t), b.estado(t));
  }

  const final = a.pose("c1", 3);
  assert.ok(Math.abs(final.y - (config.alto - 15)) <= 2, `y final ${final.y} no está a 2 px del suelo`);
  assert.equal(a.pose("c2", 0.59).visible, false);
  assert.equal(a.pose("c2", 0.61).visible, true);
  const tAnterior = 0.5;
  const tSiguiente = tAnterior + 1 / config.fps;
  const poseAnterior = a.estado(tAnterior).find((x) => x.id === "c1");
  const poseSiguiente = a.estado(tSiguiente).find((x) => x.id === "c1");
  const tIntermedio = tAnterior + 0.5 / config.fps;
  const poseIntermedia = a.pose("c1", tIntermedio);
  const yIntermedioEsperado = (poseAnterior.y + poseSiguiente.y) / 2;
  assert.notEqual(poseAnterior.y, poseSiguiente.y, "el cuerpo debe moverse entre los dos fotogramas guardados");
  assert.ok(Math.abs(poseIntermedia.y - yIntermedioEsperado) < 1e-9,
    `pose() debe interpolar entre los fotogramas vecinos: ${poseIntermedia.y} != ${yIntermedioEsperado}`);
  assert.deepStrictEqual(a.pose("c1", -1), a.pose("c1", 0));
  assert.deepStrictEqual(a.pose("c1", 4), a.pose("c1", 3));
  assert.equal(a.duration, a.duracion);
  assert.equal(a.state, a.estado);
  assert.equal(a.apply, a.aplicar);

  assert.throws(() => MAFIA.fisica.simular({ ...config, cuerpos: [config.cuerpos[0], config.cuerpos[0]] }), /repetido/);
  assert.throws(() => MAFIA.fisica.simular({ ...config, uniones: [{ a: "c1", b: "desconocido" }] }), /desconocido/);
  assert.throws(() => MAFIA.fisica.simular({ ...config, duracion: 100, fps: 100, subpasos: 3 }), /reduce fps o subpasos/);
});

test("fisica conserva uniones, resuelve colisiones y activa cuerpos fuera de la rejilla", () => {
  const MAFIA = cargarMAFIA();
  const pendulo = MAFIA.fisica.simular({
    ancho: 400, alto: 300, duracion: 2, fps: 30, subpasos: 2, gravedad: 0.3, semilla: 9,
    limites: false,
    cuerpos: [{ id: "pendulo", forma: "circulo", x: 260, y: 100, r: 12 }],
    uniones: [{ a: "pendulo", punto: { x: 200, y: 100 }, longitud: 60, rigidez: 0.9, amortiguacion: 0.05 }],
  });
  for (const t of [0, 0.17, 0.5, 1.03, 1.9]) {
    const pose = pendulo.pose("pendulo", t);
    const distancia = Math.hypot(pose.x - 200, pose.y - 100);
    assert.ok(Math.abs(distancia - 60) < 1.5, `unión fuera de tolerancia en t=${t}: ${distancia}`);
  }

  const torre = {
    ancho: 320, alto: 240, duracion: 2, fps: 30, subpasos: 2, gravedad: 1, semilla: 11,
    limites: { suelo: true, paredes: true, techo: false, grosor: 200 },
    cuerpos: [
      { id: "abajo", forma: "circulo", x: 160, y: -20, r: 18 },
      { id: "medio", forma: "circulo", x: 160, y: -58, r: 18 },
      { id: "arriba", forma: "circulo", x: 160, y: -96, r: 18 },
      { id: "fuera-rejilla", forma: "circulo", x: 80, y: -35, r: 10, entra: 0.271 },
    ],
  };
  const a = MAFIA.fisica.simular(torre);
  const b = MAFIA.fisica.simular(torre);
  for (const t of [1.7, 0.271, 0.5, 0.27, 1.1, 0.271]) {
    assert.deepStrictEqual(a.estado(t), b.estado(t), `seek no repetible en t=${t}`);
  }
  assert.equal(a.pose("fuera-rejilla", 0.27).visible, false);
  assert.equal(a.pose("fuera-rejilla", 0.271).visible, true);
  for (const t of [0.5, 1, 1.7]) {
    const poses = a.estado(t).filter((p) => ["abajo", "medio", "arriba"].includes(p.id));
    for (let i = 0; i < poses.length; i++) {
      for (let j = i + 1; j < poses.length; j++) {
        const distancia = Math.hypot(poses[i].x - poses[j].x, poses[i].y - poses[j].y);
        assert.ok(distancia >= 35, `círculos solapados en t=${t}: ${poses[i].id}/${poses[j].id}=${distancia}`);
      }
    }
  }
});

test("fisica escala la simulación completa a la duración de la timeline", () => {
  const llamadas = [];
  const MAFIA = cargarMAFIA({ gsap: { set(_elemento, valores) { llamadas.push(valores); } } });
  MAFIA.$ = (elemento) => elemento;
  let dibujar;
  MAFIA.porCuadro = (_tl, _at, _dur, fn) => { dibujar = fn; };
  const sim = MAFIA.fisica.simular({
    ancho: 320, alto: 240, duracion: 3, fps: 30, subpasos: 2, gravedad: 1,
    limites: { suelo: true, paredes: true },
    cuerpos: [{ id: "c", forma: "rect", x: 100, y: -20, w: 30, h: 30 }],
  });
  sim.aplicar({}, { at: 0, dur: 6, elementos: { c: {} } });
  dibujar(0.5);
  assert.ok(Math.abs(llamadas.at(-1).y - (sim.pose("c", 1.5).y - 15)) < 1e-9);
  dibujar(1);
  assert.ok(Math.abs(llamadas.at(-1).y - (sim.pose("c", 3).y - 15)) < 1e-9);
});

test("fisica limita cuerpos, uniones, memoria de poses y trabajo estimado", () => {
  const MAFIA = cargarMAFIA();
  const cuerpo = (id) => ({ id, forma: "circulo", x: 100, y: 100, r: 5 });
  const base = { ancho: 320, alto: 240, duracion: 0, limites: false, cuerpos: [] };
  assert.throws(() => MAFIA.fisica.simular({ ...base, cuerpos: Array.from({ length: 101 }, (_, i) => cuerpo(`c${i}`)) }), /máximo es 100/);
  assert.throws(() => MAFIA.fisica.simular({
    ...base, cuerpos: [cuerpo("c")],
    uniones: Array.from({ length: 201 }, () => ({ a: "c", punto: { x: 100, y: 100 } })),
  }), /máximo es 200/);
  assert.throws(() => MAFIA.fisica.simular({
    ancho: 320, alto: 240, duracion: 1000, fps: 1, subpasos: 1, limites: false,
    cuerpos: Array.from({ length: 100 }, (_, i) => cuerpo(`p${i}`)),
  }), /poses precalculadas/);
  assert.throws(() => MAFIA.fisica.simular({
    ancho: 320, alto: 240, duracion: 1000, fps: 1, subpasos: 20, limites: false,
    cuerpos: Array.from({ length: 50 }, (_, i) => cuerpo(`t${i}`)),
  }), /preparación demasiado costosa/);
});

test("fx calcula tamaños de bloque positivos y monótonos", () => {
  const MAFIA = cargarMAFIA();
  assert.equal(MAFIA.fx.bloque(0, 1, 40), 1);
  assert.equal(MAFIA.fx.bloque(1, 1, 40), 40);
  assert.equal(MAFIA.fx.pixelate, MAFIA.fx.pixelar);
  assert.equal(MAFIA.fx.blockSize, MAFIA.fx.bloque);
  const valores = Array.from({ length: 101 }, (_, i) => MAFIA.fx.bloque(i / 100, 1, 40));
  assert.ok(valores.every((x) => x >= 1));
  assert.ok(valores.every((x, i) => i === 0 || x >= valores[i - 1]));
});

test("fx pixelar renderiza píxeles seek-safe y restaura el estado real del canvas", async () => {
  const servidor = createServer((req, res) => {
    if (req.url === "/foreign.svg") {
      res.writeHead(200, { "content-type": "image/svg+xml" });
      res.end('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="red"/></svg>');
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<!doctype html><title>canvas test</title>");
  });
  await new Promise((resolve, reject) => {
    servidor.once("error", reject);
    servidor.listen(0, "0.0.0.0", resolve);
  });
  let browser;
  try {
    const chromePath = execFileSync("pnpm", ["exec", "hyperframes", "browser", "path"], { encoding: "utf8" }).trim();
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    const port = servidor.address().port;
    await page.goto(`http://localhost:${port}/`);
    const resultado = await page.evaluate((codigo, origenExterno) => {
      window.MAFIA = {
        porCuadro(tl, at, dur, fn, ease) {
          tl.to({}, { mafiaCuadro: { fn }, duration: dur, ease }, at);
        },
      };
      window.eval(codigo);

      function preparar(ancho, alto, origen, hasta) {
        const destino = document.createElement("canvas");
        destino.width = ancho;
        destino.height = alto;
        const contexto = destino.getContext("2d");
        contexto.setTransform(2, 0, 0, 2, 7, 9);
        contexto.imageSmoothingEnabled = true;
        let render;
        const tl = {
          to(_objetivo, vars, at) {
            if (at !== 0) throw new Error("inicio inesperado de timeline");
            render = vars.mafiaCuadro.fn;
            return this;
          },
        };
        MAFIA.fx.pixelar(tl, { at: 0, dur: 1, destino, origen, desde: 1, hasta });
        return { destino, contexto, render };
      }

      function crearOrigen(ancho, alto, colorEn) {
        const canvas = document.createElement("canvas");
        canvas.width = ancho;
        canvas.height = alto;
        const contexto = canvas.getContext("2d");
        const imagen = contexto.createImageData(ancho, alto);
        for (let y = 0; y < alto; y++) {
          for (let x = 0; x < ancho; x++) imagen.data.set(colorEn(x, y), (y * ancho + x) * 4);
        }
        contexto.putImageData(imagen, 0, 0);
        return canvas;
      }

      const colores = [
        [[255, 0, 0, 255], [0, 255, 0, 255]],
        [[0, 0, 255, 255], [255, 255, 0, 255]],
      ];
      const origen4 = crearOrigen(4, 4, (x, y) => colores[Math.floor(y / 2)][Math.floor(x / 2)]);
      const cuatro = preparar(4, 4, origen4, 2);
      const antes = cuatro.contexto.getTransform();
      const estado = { a: antes.a, b: antes.b, c: antes.c, d: antes.d, e: antes.e, f: antes.f,
        suavizado: cuatro.contexto.imageSmoothingEnabled };
      cuatro.render(1);
      const primerRender = [...cuatro.contexto.getImageData(0, 0, 4, 4).data];
      const esperado4 = [];
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) esperado4.push(...colores[Math.floor(y / 2)][Math.floor(x / 2)]);
      }
      const despues = cuatro.contexto.getTransform();
      const restaurado = estado.a === despues.a && estado.b === despues.b && estado.c === despues.c
        && estado.d === despues.d && estado.e === despues.e && estado.f === despues.f
        && estado.suavizado === cuatro.contexto.imageSmoothingEnabled;
      cuatro.render(0.5);
      cuatro.render(0);
      cuatro.render(1);
      const seekSafe = primerRender.every((valor, i) => valor === cuatro.contexto.getImageData(0, 0, 4, 4).data[i]);

      const origen6 = crearOrigen(6, 2, (x) => x < 3 ? [12, 34, 56, 255] : [78, 90, 123, 255]);
      const seis = preparar(6, 2, origen6, 3);
      seis.render(1);
      const esperado6 = [];
      for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 6; x++) esperado6.push(...(x < 3 ? [12, 34, 56, 255] : [78, 90, 123, 255]));
      }
      const imagenExterna = new Image();
      imagenExterna.src = origenExterno;
      return imagenExterna.decode().then(() => {
        let errorOrigen = "";
        try {
          MAFIA.fx.pixelar({ to() { return this; } }, {
            dur: 1,
            destino: document.createElement("canvas"),
            origen: imagenExterna,
          });
        } catch (error) {
          errorOrigen = error.message;
        }
        return {
          pixels4: primerRender,
          esperado4,
          restaurado,
          seekSafe,
          pixels6: [...seis.contexto.getImageData(0, 0, 6, 2).data],
          esperado6,
          errorOrigen,
        };
      });
    }, codigoFx, `http://127.0.0.1:${port}/foreign.svg`);

    assert.deepEqual(resultado.pixels4, resultado.esperado4);
    assert.equal(resultado.restaurado, true, "el contexto debe recuperar transform y suavizado previos");
    assert.equal(resultado.seekSafe, true, "volver a un progreso tras seeks fuera de orden debe repetir el mismo render");
    assert.deepEqual(resultado.pixels6, resultado.esperado6, "el tamaño del bloque debe adaptarse a otra resolución");
    assert.match(resultado.errorOrigen, /mismo origen y permitir lectura de píxeles/);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve, reject) => servidor.close((error) => error ? reject(error) : resolve()));
  }
});

test("fx pixelar rechaza vídeo, imagen sin decodificar y orígenes no admitidos", () => {
  const MAFIA = cargarMAFIA();
  const destino = { width: 4, height: 4, getContext: () => ({}) };
  const tl = { to() { return this; } };
  assert.throws(() => MAFIA.fx.pixelar(tl, { dur: 1, destino, origen: { tagName: "VIDEO" } }), /vídeo no permitido/);
  assert.throws(() => MAFIA.fx.pixelar(tl, { dur: 1, destino, origen: { tagName: "IMG", complete: false, naturalWidth: 0 } }), /decodificada/);
  assert.throws(() => MAFIA.fx.pixelar(tl, { dur: 1, destino, origen: "imagen.png" }), /origen debe ser/);
});
