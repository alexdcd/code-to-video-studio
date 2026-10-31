#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPython } from "./lib/python-runner.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  const result = runPython(path.join(root, "scripts/lib/analyze-video.py"), process.argv.slice(2).filter(argument => argument !== "--"), {
    cwd: root,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(`Analysis failed: ${error.message}`);
  process.exitCode = 1;
}
