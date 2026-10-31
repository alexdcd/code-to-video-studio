#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPython } from "./lib/python-runner.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [command, ...args] = process.argv.slice(2);
if (!["phrases", "map"].includes(command)) {
  console.error("Usage: pnpm run voice:phrases -- <options> | pnpm run voice:map -- <options>");
  process.exitCode = 2;
} else {
  try {
    const result = runPython(path.join(root, "scripts/lib/voice-sync.py"), [command, ...args.filter(argument => argument !== "--")], {
      cwd: root,
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } catch (error) {
    console.error(`Voice timing failed: ${error.message}`);
    process.exitCode = 1;
  }
}
