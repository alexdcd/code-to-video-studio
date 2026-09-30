// kit/lib/three-desenfoque.js · Desenfoque de movimiento determinista para Three.js (módulo ES, usa el importmap «three»).
//
// Promedia N subfotogramas dentro del obturador en un render target de coma flotante (half-float, lineal) y pasa
// el resultado por el mismo tone mapping y espacio de color que un render normal. Cada fotograma sigue siendo
// función pura del tiempo: no hay estado entre fotogramas, así que buscar hacia delante/atrás da el mismo píxel.
//
//   import { crearDesenfoque } from "./assets/kit/lib/three-desenfoque.js";
//   const dm = crearDesenfoque(renderer);              // una vez, tras crear el renderer
//   // en cada fotograma (hf-seek / onUpdate):
//   dm.render(scene, camera, posar, t, { fps: 60, muestras: 24, obturador: 0.83 });
//
// `posar(tt)` debe colocar TODO lo que se mueve para el instante tt (función pura de tt). Con `muestras <= 1` o
// `obturador <= 0` es un render normal. Regla práctica medida en una pieza real: 180° (obturador 0.5) se ve seco
// junto a imagen real; ~300° (0.83) durante el movimiento más rápido y vuelta a 180° se parece más. Con 10
// subfotogramas se ve un peine en un borde rápido; 24 lo limpian. Sube obturador desde 0 en ~6 fotogramas en los
// extremos de la ventana para que el desenfoque no aparezca de golpe. Coste: N renders por fotograma; úsalo solo en los
// tramos rápidos.
// Fondo: usa `renderer.setClearColor` (o déjalo transparente). Un `scene.background` se dibujaría dentro de cada
// subfotograma y pasaría por el tone mapping de la pasada final, distinto de un render normal. El fondo se compone
// al final sin tone mapping, igual que hace el renderer, así que con obturador ~0 el resultado iguala al render normal.
import * as THREE from "three";

export function crearDesenfoque(renderer) {
  const tam = new THREE.Vector2();
  const opciones = { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true };
  let rtSub = null, rtAcc = null;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geo = new THREE.PlaneGeometry(2, 2);
  const sumar = new THREE.ShaderMaterial({
    uniforms: { mapa: { value: null }, peso: { value: 1 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }",
    // se acumula premultiplicado: donde el objeto solo cubre parte de los subfotogramas, el alfa es la cobertura
    fragmentShader: "uniform sampler2D mapa; uniform float peso; varying vec2 vUv; void main(){ vec4 c = texture2D(mapa, vUv); gl_FragColor = vec4(c.rgb * c.a, c.a) * peso; }",
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    depthTest: false, depthWrite: false, transparent: true,
  });
  // Pasada final: desmultiplica el acumulado, le aplica el tone mapping y el espacio de color del renderer y compone
  // el fondo (ya en espacio de pantalla) por debajo según la cobertura. Salida premultiplicada, como un canvas normal.
  const salida = new THREE.ShaderMaterial({
    uniforms: { mapa: { value: null }, fondo: { value: new THREE.Vector4() } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }",
    fragmentShader: `uniform sampler2D mapa; uniform vec4 fondo; varying vec2 vUv;
      void main(){
        vec4 a = texture2D(mapa, vUv);
        gl_FragColor = vec4(a.a > 0. ? a.rgb / a.a : vec3(0.), 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor = vec4(gl_FragColor.rgb * a.a + fondo.rgb * fondo.a * (1. - a.a), a.a + fondo.a * (1. - a.a));
      }`,
    toneMapped: true, depthTest: false, depthWrite: false,
  });
  const quadSumar = new THREE.Mesh(geo, sumar);
  const quadSalida = new THREE.Mesh(geo, salida);
  quadSumar.frustumCulled = quadSalida.frustumCulled = false;
  const escSumar = new THREE.Scene().add(quadSumar);
  const escSalida = new THREE.Scene().add(quadSalida);

  function asegurar() {
    renderer.getDrawingBufferSize(tam);
    if (!rtSub || rtSub.width !== tam.x || rtSub.height !== tam.y) {
      rtSub?.dispose(); rtAcc?.dispose();
      rtSub = new THREE.WebGLRenderTarget(tam.x, tam.y, opciones);
      rtAcc = new THREE.WebGLRenderTarget(tam.x, tam.y, { ...opciones, depthBuffer: false });
    }
  }

  function render(scene, camera, posar, t, { fps = 60, muestras = 24, obturador = 0.5 } = {}) {
    if (muestras <= 1 || obturador <= 0) { posar(t); renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
    asegurar();
    const auto = renderer.autoClear, col = renderer.getClearColor(new THREE.Color()), alfa = renderer.getClearAlpha();
    const pantalla = new THREE.Color().copy(col).convertLinearToSRGB();   // el clear color se escribe sin tone mapping
    salida.uniforms.fondo.value.set(pantalla.r, pantalla.g, pantalla.b, alfa);
    renderer.autoClear = false;
    renderer.setRenderTarget(rtAcc); renderer.setClearColor(0x000000, 0); renderer.clear();
    sumar.uniforms.peso.value = 1 / muestras;
    for (let i = 0; i < muestras; i++) {
      posar(t + ((i + 0.5) / muestras - 0.5) * obturador / fps);
      renderer.setRenderTarget(rtSub); renderer.setClearColor(0x000000, 0); renderer.clear();
      renderer.render(scene, camera);
      sumar.uniforms.mapa.value = rtSub.texture;
      renderer.setRenderTarget(rtAcc); renderer.render(escSumar, cam);
    }
    salida.uniforms.mapa.value = rtAcc.texture;
    renderer.setRenderTarget(null); renderer.setClearColor(col, alfa); renderer.clear();
    renderer.render(escSalida, cam);
    renderer.autoClear = auto;
    posar(t); // deja la escena en el instante pedido por si otro código la consulta (anclas proyectadas, etc.)
  }

  return { render, dispose() { rtSub?.dispose(); rtAcc?.dispose(); geo.dispose(); sumar.dispose(); salida.dispose(); } };
}
