// kit/lib/three-anotaciones.js · Etiquetas HTML/SVG con línea guía sobre puntos 3D proyectados a pantalla (módulo ES).
//
// La 3D explica lo físico; el texto y los rótulos se quedan en HTML/SVG, nítidos. Este módulo une ambos: cada
// fotograma proyecta unos puntos de la escena a píxeles y coloca una columna de etiquetas equiespaciadas con su
// línea guía. Todo es función pura de `t` y de la cámara: sin estado entre fotogramas, seguro al seek.
//
//   import { proyectar, montarAnotaciones } from "./assets/kit/lib/three-anotaciones.js";
//   const anot = montarAnotaciones(document.querySelector("#s03-capa"), [
//     { id: "ala", numero: "01", texto: "Ala" }, { id: "motor", numero: "02", texto: "Motor" },
//   ], { ancho: 1920, alto: 1080, prefijo: "s03" });
//   // en cada fotograma, con la escena ya colocada para t:
//   camera.updateMatrixWorld();
//   anot.actualizar(t, proyectar(camera, [{ id: "ala", punto: alaMesh }, { id: "motor", punto: new Vector3(0, 1, 2) }], 1920, 1080),
//                   { inicio: 1.2 });
//
// Colores y tipografía por variables CSS del contenedor (ninguna marca fija): --anot-tinta (texto y línea),
// --anot-acento (punto), --anot-papel (texto del número) y --anot-fuente. Las etiquetas se ordenan por la altura de
// su punto y se reparten a intervalos IGUALES (más importante para el ojo que alinear cada una con su punto).
// Límite: no calcula oclusión; si un punto queda tapado, la etiqueta sigue ahí (ocúltalo tú con `visible: false`).

const acotar = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const salida = (x) => 1 - Math.pow(1 - acotar(x), 3);
const suave = (x) => { x = acotar(x); return x * x * (3 - 2 * x); };
const SVG = "http://www.w3.org/2000/svg";

const CSS = `
.anot-lineas{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.anot-lineas path{fill:none;stroke:var(--anot-tinta,#111);stroke-width:2}
.anot-lineas circle{fill:var(--anot-acento,#e8c547);stroke:var(--anot-tinta,#111);stroke-width:3}
.anot-lineas .anot-anillo{fill:none;stroke:var(--anot-acento,#e8c547);stroke-width:2}
.anot-etiqueta{position:absolute;left:0;top:0;display:flex;align-items:center;gap:12px;white-space:nowrap;
  color:var(--anot-tinta,#111);font:650 26px/1 var(--anot-fuente,system-ui,sans-serif);letter-spacing:-.3px}
.anot-etiqueta b{font-size:17px;letter-spacing:2px;color:var(--anot-papel,#fff);background:var(--anot-tinta,#111);padding:6px 9px;font-weight:600}
`;

function asegurarEstilo(raiz) {
  const doc = raiz.ownerDocument;
  if (!doc.getElementById("anot-estilo")) {
    const s = doc.createElement("style");
    s.id = "anot-estilo";
    s.textContent = CSS;
    doc.head.appendChild(s);
  }
}

/** Proyecta puntos 3D a píxeles. `puntos`: [{id, punto}] con `punto` = Vector3 o Object3D (posición en mundo).
 *  Devuelve [{id, x, y, visible}]; visible = delante de la cámara y dentro del encuadre. */
export function proyectar(camera, puntos, ancho = 1920, alto = 1080) {
  return puntos.map(({ id, punto }) => {
    const v = punto.isObject3D ? punto.getWorldPosition(punto.position.clone()) : punto.clone();
    v.project(camera);
    const x = (v.x * 0.5 + 0.5) * ancho, y = (-v.y * 0.5 + 0.5) * alto;
    return { id, x, y, visible: v.z > -1 && v.z < 1 && x >= 0 && x <= ancho && y >= 0 && y <= alto };
  });
}

/** Monta las etiquetas en `raiz` (un contenedor posicionado). `items`: [{id, numero, texto}].
 *  Opciones: ancho, alto (1920×1080), prefijo (para ids únicos), columnaX (x de la columna, 0.78·ancho),
 *  separacionMin (alto mínimo entre etiquetas, 84), margen (distancia a los bordes, 70), codo (0.45). */
export function montarAnotaciones(raiz, items, opciones = {}) {
  const { ancho = 1920, alto = 1080, prefijo = "anot", columnaX = ancho * 0.78, separacionMin = 84, margen = 70, codo = 0.45 } = opciones;
  asegurarEstilo(raiz);
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "anot-lineas");
  svg.setAttribute("width", ancho);
  svg.setAttribute("height", alto);
  svg.id = `${prefijo}-lineas`;
  raiz.appendChild(svg);
  const els = items.map(({ id, numero, texto }) => {
    const d = document.createElement("div");
    d.className = "anot-etiqueta";
    d.id = `${prefijo}-etiqueta-${id}`;
    const n = document.createElement("b");
    n.textContent = numero ?? "";
    const t = document.createElement("span");
    t.textContent = texto;
    d.append(n, t);
    raiz.appendChild(d);
    const linea = document.createElementNS(SVG, "path"), anillo = document.createElementNS(SVG, "circle"), punto = document.createElementNS(SVG, "circle");
    anillo.setAttribute("class", "anot-anillo");
    punto.setAttribute("r", 7);
    svg.append(linea, anillo, punto);
    return { id, d, linea, anillo, punto };
  });

  /** anclas: salida de proyectar(). inicio: t en que entra la primera; escalonado: retraso entre etiquetas. */
  function actualizar(t, anclas, { inicio = 0, escalonado = 0.11, duracion = 0.32 } = {}) {
    const vivas = anclas.map((a, i) => ({ a, i, el: els.find((e) => e.id === a.id) })).filter((r) => r.el);
    const ordenadas = vivas.filter((r) => r.a.visible !== false).sort((p, q) => p.a.y - q.a.y);
    const n = ordenadas.length;
    // reparto equiespaciado: tramo entre el primer y el último punto, con un mínimo, centrado y dentro del encuadre
    const y0 = n ? ordenadas[0].a.y : 0, y1 = n ? ordenadas[n - 1].a.y : 0;
    const paso = n > 1 ? Math.max(separacionMin, (y1 - y0) / (n - 1)) : 0;
    const alturaTotal = paso * (n - 1);
    const arriba = acotar((y0 + y1) / 2 - alturaTotal / 2, margen, Math.max(margen, alto - margen - alturaTotal));
    ordenadas.forEach((r, k) => { r.ly = arriba + k * paso; });
    for (const e of els) { // lo que no tiene ancla visible se oculta del todo
      if (!ordenadas.some((r) => r.el === e)) { e.d.style.opacity = 0; e.linea.style.opacity = 0; e.anillo.style.opacity = 0; e.punto.style.opacity = 0; }
    }
    ordenadas.forEach(({ a, el, ly }, k) => {
      const orden = vivas.findIndex((r) => r.el === el);
      const on = salida((t - inicio - orden * escalonado) / duracion);
      const lx = Math.max(a.x + 90, columnaX);
      el.d.style.transform = `translate(${lx + 14}px, ${ly - 18}px)`;
      el.d.style.opacity = on;
      el.d.style.clipPath = `inset(0 ${100 - 100 * on}% 0 0)`;
      const ruta = `M${a.x} ${a.y}L${a.x + (lx - a.x) * codo} ${ly}L${lx} ${ly}`;
      el.linea.setAttribute("d", ruta);
      const largo = el.linea.getTotalLength();
      el.linea.style.strokeDasharray = largo;
      el.linea.style.strokeDashoffset = largo * (1 - on);
      el.linea.style.opacity = on > 0 ? 1 : 0;
      for (const c of [el.punto, el.anillo]) { c.setAttribute("cx", a.x); c.setAttribute("cy", a.y); }
      el.punto.style.opacity = on;
      const pulso = (t - inicio - orden * escalonado - 0.2) / 0.5;
      el.anillo.style.opacity = on * (1 - suave(pulso));
      el.anillo.setAttribute("r", 8 + 22 * suave((t - inicio - orden * escalonado) / 0.7));
    });
  }
  return { actualizar, etiquetas: els, dispose() { svg.remove(); els.forEach((e) => e.d.remove()); } };
}
