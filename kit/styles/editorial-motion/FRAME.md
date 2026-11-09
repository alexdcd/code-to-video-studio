---
version: "1"
name: Editorial Motion
description: Geometría editorial plana y cinética sobre navy/crema, con seis colores vivos, Inter contundente y movimiento que dirige la lectura.
unit: 1920x1080; vertical 1080x1920 con la clase em-escena--vertical
principle: Una lectura por vez. La forma organiza, el movimiento explica y el espacio deja leer.

colors:
  noche: "#0F1A3D"
  crema: "#FFF1D6"
  azul: "#3B7BFF"
  coral: "#FF6B5C"
  amarillo: "#FFC83D"
  menta: "#2EDBA8"

typography:
  family: "Inter (kit/fonts)"
  headline: { weight: 900, size: "126px", case: "uppercase", tracking: "-0.065em" }
  title: { weight: 800, size: "54px", case: "sentence" }
  figure: { weight: 900, size: "290px", tracking: "-0.09em" }
  body: { weight: 500, size: "30px", line-height: 1.35 }
  label: { weight: 700, size: "18px", case: "uppercase", tracking: "0.16em" }

spacing:
  safe-area: "120px on 16:9; vertical: x 90-990, y 200-1440 for essential copy (subtitles and platform UI sit below); keep moving shapes at least 80px from essential copy"
  section-gap: "48px"
  title-copy-gap: "36px"
  scene-hold: "0.35–0.6s after a key read"

components:
  headline:
    description: Two-line typographic reveal with a colored word and a geometric counter-shape.
  data:
    description: One oversized number or metric with a short explanatory line.
  comparison:
    description: Two contrasting states, shown side by side with one shared scale and one visual shift.
  process:
    description: Three steps connected by a line or by one travelling geometric object.
  callout:
    description: One short annotation anchored to the shape it explains.
  icon-label:
    description: Simple geometry next to one concise label; avoid pictograms that imitate a known character.
  graph:
    description: A small number of bars, blocks or points; use a single active accent.
  layer-scene:
    description: Three or four planes with increasing travel from far to near; overscan every moving layer.
  transition:
    description: Shape mask or zoom-through anchored to a meaningful circle, letter or object.
