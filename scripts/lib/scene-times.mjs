#!/usr/bin/env node
// Instantes de revisión por escena, leídos de `hyperframes timeline --json` (estático, no abre navegador).
// Uso: node scripts/lib/scene-times.mjs <dir-proyecto> --check   → «t1,t2,…» (mitad y lleno de cada escena)
//      node scripts/lib/scene-times.mjs <dir-proyecto> --json    → lista completa de escenas e instantes
// Si no puede leer la línea de tiempo no imprime nada y sale con 1: quien llama decide el fallback.
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sceneRows, sceneSampleTimes } from "./review-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const HF = path.join(ROOT, "node_modules", "hyperframes", "bin", "hyperframes.mjs");

export function readSceneTimes(projectDir) {
  const result = spawnSync(process.execPath, [HF, "timeline", "--json"], {
    cwd: projectDir, encoding: "utf8", timeout: 60000, maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`hyperframes timeline failed: ${result.stderr || result.stdout}`);
  const timeline = JSON.parse(result.stdout);
  return { duration: Number(timeline?.timeline?.duration) || null, scenes: sceneSampleTimes(sceneRows(timeline)) };
}

export function checkTimes(scenes) {
  return [...new Set(scenes.flatMap(scene => [scene.midpointSeconds, scene.fullSeconds]))].sort((a, b) => a - b);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dir, mode = "--check"] = process.argv.slice(2);
  try {
    const { duration, scenes } = readSceneTimes(path.resolve(dir ?? "."));
    if (!scenes.length) process.exit(1);
    if (mode === "--json") console.log(JSON.stringify({ duration, scenes }, null, 2));
    else console.log(checkTimes(scenes).join(","));
  } catch {
    process.exit(1);
  }
}
