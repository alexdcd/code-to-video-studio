# Lottie en el estudio

Lottie es un formato JSON de animación vectorial (se exporta desde After Effects con Bodymovin o se descarga de
bibliotecas como LottieFiles). Sirve para traer animaciones **ya hechas**: iconos animados, ilustraciones, checks,
confeti, micro-UI. No sustituye a GSAP: lo que diseñas tú se sigue haciendo con GSAP/SVG/canvas.

Úsalo cuando el BRIEF pida una animación que exista ya en Lottie con licencia clara, o cuando alguien entregue un
`.json` de After Effects. Si hay que dibujarla desde cero, hazla con el kit.

## Cómo funciona aquí

HyperFrames tiene un adaptador nativo: descubre las animaciones registradas en `window.lottie` y en cada fotograma
las coloca en `tiempo desde el inicio de su composición × fps de la animación`. Tú solo la creas; **no llames a
`play()`, `goToAndPlay()` ni `setSpeed()`**.

Comprobado con un render (HyperFrames 0.8.81, lottie-web 5.13): posición exacta por fotograma, dos renders con
fotogramas idénticos, desfase correcto dentro de una subcomposición que empieza más tarde, `ruta` asíncrona y bucle.

## Uso

1. En `index.html`, antes de `mafia-kit.js` (el kit ya trae la librería en `assets/kit/lib/vendor/`):

   ```html
   <script src="assets/kit/lib/vendor/lottie/lottie_svg.min.js"></script>
   ```

2. El JSON va en `assets/lottie/` del proyecto, con su licencia anotada (ver abajo).

3. En la composición:

   ```html
   <div id="s03-check" class="lottie"></div>
   <script>
     MAFIA.lottie("#s03-check", { ruta: "assets/lottie/check.json" });
     // o con el JSON ya cargado: MAFIA.lottie("#s03-check", { datos: window.LOTTIE_CHECK, bucle: true });
   </script>
   ```

   | Opción | Qué hace |
   | --- | --- |
   | `datos` | objeto JSON ya cargado (se copia: puedes reutilizarlo en varias animaciones) |
   | `ruta` | ruta al `.json` relativa al proyecto |
   | `bucle` | `false` (por defecto) se queda en el último cuadro; `true` repite |
   | `encaje` | `preserveAspectRatio` del SVG (`"xMidYMid meet"` por defecto; `"xMidYMid slice"` para cubrir) |

   Usa el helper y no `lottie.loadAnimation` directo: fija `autoplay: false` y el renderer SVG, y falla con un mensaje
   claro si falta la librería.

## Reglas

- **Empieza al inicio de su composición.** Para que arranque en el segundo 4, ponla en una subcomposición con
  `data-start="4"`. No hay desfase ni velocidad por parámetro: si necesitas otro ritmo, cambia la duración en el
  origen (After Effects) o elige otra animación.
- **Mueve el contenedor, no la animación.** Posición, escala, opacidad y entradas/salidas del `div` contenedor se
  animan con GSAP como cualquier otro elemento (sin `transform` en CSS, con tamaño y `display: block`).
- **Colores de marca:** Lottie trae los colores dentro del JSON. Si no encajan, cámbialos en el JSON (campos `c`
  de los rellenos/trazos) y guarda el original junto al modificado.
- **Revísalo en fotogramas**, como todo: hay funciones de After Effects que lottie-web no reproduce igual.

## Licencias

El Studio usa lottie-web 5.13.x, con licencia MIT. npm run vendor copia el runtime y su LICENSE.md a
kit/lib/vendor/lottie/, de modo que el aviso acompaña a la librería al copiar el kit a un proyecto.

Cada `.json` de terceros entra con su licencia y procedencia anotadas (URL, autor, licencia) en un `LICENCIA.md`
junto al archivo o, si se promueve al kit, en `kit/LICENCIAS.md`. «Gratis para descargar» no es una licencia: si no
está clara, no se usa.
