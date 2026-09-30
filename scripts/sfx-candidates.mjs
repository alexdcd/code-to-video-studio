import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const venv=process.platform==="win32" ? path.join(ROOT,".venv-sfx","Scripts","python.exe") : path.join(ROOT,".venv-sfx","bin","python");
const py=fs.existsSync(venv) ? venv : (process.platform==="win32" ? "python" : "python3");
const r=spawnSync(py,[path.join(ROOT,"tools/sfx/candidates.py"),...process.argv.slice(2)],{cwd:ROOT,stdio:"inherit",shell:false});
if (r.error?.code==="ENOENT") {
  console.error("Python not found. Install Python 3, then run npm run sfx:setup.");
  process.exit(1);
}
process.exit(r.status ?? 1);
