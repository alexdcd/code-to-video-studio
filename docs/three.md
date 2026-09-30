# Three.js

Code to Video Studio vendors Three.js locally during `npm run setup` and exposes it through the starter import map:

```js
import * as THREE from "three";
```

Two generic helpers from the production studio are included.

## Deterministic motion blur

`kit/lib/three-desenfoque.js` accumulates multiple subframes inside a virtual shutter and then applies the renderer's tone mapping / output color space.

```js
import { crearDesenfoque } from "./assets/kit/lib/three-desenfoque.js";

const blur = crearDesenfoque(renderer);
const pose = (tt) => {
  object.rotation.z = rotationAt(tt); // derive all moving state from tt
};

blur.render(scene, camera, pose, t, {
  fps: 60,
  muestras: 24,
  obturador: 0.83,
});
```

The key rule is the same as the rest of the studio: `pose(tt)` must fully determine the moving state. Do not advance physics from the previous frame.

Higher sample counts cost more renders. Use the helper only where fast motion actually benefits from blur.

## HTML/SVG annotations on 3D points

`kit/lib/three-anotaciones.js` projects Three.js points to screen coordinates while keeping labels in crisp HTML/SVG.

```js
import { proyectar, montarAnotaciones } from "./assets/kit/lib/three-anotaciones.js";

const labels = montarAnotaciones(document.querySelector("#overlay"), [
  { id: "engine", numero: "01", texto: "Engine" },
], { ancho: 1920, alto: 1080, prefijo: "s03" });

camera.updateMatrixWorld();
const anchors = proyectar(camera, [
  { id: "engine", punto: engineMesh },
], 1920, 1080);

labels.actualizar(t, anchors, { inicio: 1.2 });
```

It does not solve occlusion automatically. Hide an annotation yourself when its anchor should not be visible.

## Practical rendering notes

- Keep the renderer/camera state deterministic at every seek.
- Measure rendered colors when tone mapping matters; CSS input values are not proof of final pixels.
- Prefer a stable camera to decorative camera wobble.
- Use local web fonts rather than relying on system fonts in headless Chrome.
- Reuse PMREM resources rather than regenerating environment maps every frame.
- Supersampling can improve fine edges when the cost is acceptable.
