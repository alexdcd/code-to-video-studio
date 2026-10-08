# Física precalculada con Matter.js

`MAFIA.fisica` simula un mundo Matter.js una sola vez al montar la composición y guarda una pose por fotograma.
Las consultas posteriores son puras: se puede buscar hacia delante, hacia atrás o en cualquier orden sin avanzar un
motor entre cuadros. Usa esta API cuando varios cuerpos deban chocar o apilarse.

Para un solo cuerpo, un salto o un rebote estilizado que quieras controlar a mano, prefiere `MAFIA.anim.jump`,
`MAFIA.anim.spring` o `MAFIA.anim.arc`: son más simples y editables.

## Carga

En `index.html`, antes de `assets/kit/dist/mafia-kit.js`, carga el vendor local:

```html
<script src="assets/kit/lib/vendor/matter/matter.min.js"></script>
```

La librería se busca al llamar a `simular()`. El runtime no carga Matter.js para composiciones que no lo usan.

## Simular y consultar

```js
const sim = MAFIA.fisica.simular({
  ancho: 1920, alto: 1080, duracion: 4,
  fps: 60, subpasos: 2, gravedad: 1, semilla: 1,
  limites: { suelo: true, paredes: true, techo: false, grosor: 200 },
  cuerpos: [
    { id: "c1", forma: "rect", x: 900, y: -100, w: 320, h: 90, angulo: 0.1, chaflan: 12,
      rebote: 0.3, friccion: 0.4, friccionAire: 0.01, densidad: 0.001, entra: 0,
      velocidad: { x: 0, y: 0 }, velAngular: 0 },
    { id: "b1", forma: "circulo", x: 500, y: -50, r: 40, entra: 0.6 },
    { id: "p1", forma: "poligono", x: 700, y: -80, lados: 6, r: 50, entra: 1.1 },
  ],
  uniones: [
    { a: "c1", b: "b1", rigidez: 0.05, longitud: 200, amortiguacion: 0.1 },
    { a: "c1", punto: { x: 960, y: 0 }, rigidez: 0.9 },
  ],
});

sim.pose("c1", 1.25); // {x, y, angulo, visible}
sim.estado(1.25);      // poses con id, forma y dimensiones para dibujar en canvas
```

Formas: `rect` (`w`, `h`), `circulo` (`r`) y `poligono` (`lados`, `r`). `entra` decide cuándo se incorpora un cuerpo;
antes de ese instante `pose` devuelve su posición inicial con `visible: false`. Las uniones se expresan con dos ids
(`a`, `b`) o con un id y un ancla fija (`a`, `punto`). Un id repetido o una unión que nombre un id desconocido es un
error. La simulación usa `Matter.Common._seed` y `_nextId` reiniciados para producir la misma escena con la misma
configuración.

## Aplicar a elementos

Los elementos deben ser envoltorios interiores con `position: absolute; left: 0; top: 0`, `width` y `height` definidos,
y sin `transform` CSS. No apliques el helper al `.clip`: deja que HyperFrames controle la visibilidad del clip.

```js
sim.aplicar(tl, {
  at: 0, dur: sim.duracion,
  elementos: { c1: "#s01-c1", b1: document.querySelector("#s01-b1") },
});
```

La posición del centro se convierte en esquina superior izquierda y el ángulo en grados para GSAP. Para un círculo se
usa `2r` como ancho y alto. Si se construye la timeline desde una ruta asíncrona, registra
`window.__timelines["main"]` de forma síncrona y rellénala después.

`dur` es la duración de reproducción en la timeline. El helper escala la simulación precalculada completa a esa
ventana: un `dur` más corto la acelera y uno más largo la ralentiza. Si se omite, usa `sim.duracion` y conserva la
velocidad original. `at` solo desplaza el comienzo.

### Palabras que caen y se apilan

Asigna a cada tarjeta un id, su tamaño y una posición inicial por encima del encuadre. Escalona `entra` para que
aparezcan en orden, activa el suelo y llama a `aplicar` con un elemento por tarjeta. Matter calcula los choques y las
tarjetas terminan apiladas. El auditor visual marca las tarjetas que se solapan: añade
`data-layout-allow-overlap` **a cada tarjeta** que deba tocar otra, no solo al contenedor.

## Coste y límites

El paso fijo es `1000 / (fps * subpasos)` milisegundos. Se guarda una pose por fotograma y `pose(t)` interpola la
posición linealmente y el ángulo por el camino más corto. Fuera del intervalo `[0, duracion]` devuelve el extremo.
La simulación es síncrona. Para mantener acotado el tiempo de preparación y la memoria, la API limita cada escena a
20000 pasos, 100 cuerpos, 200 uniones, 100000 poses guardadas y 1000000 unidades de trabajo estimadas. La estimación
cuenta pasos, cuerpos, uniones y pares de cuerpos posibles. Si una escena supera un límite, reduce su duración,
`fps`, `subpasos` o el número de cuerpos/uniones. Los límites son internos y no requieren opciones adicionales.

## Alias en inglés

`MAFIA.physics` apunta al mismo objeto que `MAFIA.fisica` (`simulate`). El resultado ofrece `state` y `apply` además
de `estado` y `aplicar`.
