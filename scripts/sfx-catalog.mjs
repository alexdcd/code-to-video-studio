import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = path.join(root, "tools/sfx/catalog.py");
const windows = process.platform === "win32";
const candidates = windows
  ? [path.join(root, ".venv-sfx/Scripts/python.exe")]
  : [path.join(root, ".venv-sfx/bin/python")];
const python = candidates.find((candidate) => fs.existsSync(candidate)) || (windows ? "python" : "python3");
const result = spawnSync(python, [catalog, ...process.argv.slice(2)], { cwd: root, stdio: "inherit", shell: false });
if (result.error) console.error(`Unable to launch SFX catalog: ${result.error.message}`);
process.exit(result.status ?? 1);
