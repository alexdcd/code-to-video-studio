#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts", "lib", "analyze-video.py");
const python = process.env.PYTHON?.trim() || (process.platform === "win32" ? "python" : "python3");
const result = spawnSync(python, [SCRIPT, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
});
if (result.error) {
  console.error(`Could not start Python (${python}): ${result.error.message}`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
