import test from "node:test";
import assert from "node:assert/strict";
import { parseStoryboardSubtitles } from "../lib/review-core.mjs";

const tabla = (filas) => `| # | Archivo | Tiempo | Subtítulo |\n| - | - | - | - |\n${filas.join("\n")}`;

test("los tramos «no» salen como rangos a ocultar", () => {
  const r = parseStoryboardSubtitles(tabla(["| 01 | s01 | 0–3 | no · titular |", "| 02 | s02 | 3–6 | sí |"]));
  assert.deepEqual(r.hideRanges, [[0, 3]]);
  assert.equal(r.withSubtitles, 1);
});

test("avisa si todas las escenas llevan subtítulo", () => {
  const r = parseStoryboardSubtitles(tabla(["| 01 | s | 0–2 | sí |", "| 02 | s | 2–4 | sí |", "| 03 | s | 4–6 | sí |"]));
  assert.match(r.warning, /Todas las escenas/);
});

test("avisa si falta la columna", () => {
  const r = parseStoryboardSubtitles("| # | Tiempo |\n| - | - |\n| 1 | 0–3 |");
  assert.equal(r.status, "missing");
  assert.ok(r.warning);
});
