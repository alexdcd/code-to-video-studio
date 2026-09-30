import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const required=[
  "README.md","AGENTS.md","LICENSE","kit/VERSION","kit/lib/mafia.js","kit/lib/cartoon-motion.js",
  "kit/styles/starter/starter.css","kit/characters/signal/signal.js",
  "templates/starter-9x16/index.html","proyectos/demo/index.html"
];
let bad=false;
for (const rel of required) {
  if (!fs.existsSync(path.join(ROOT,rel))) { console.error("Missing:",rel); bad=true; }
}
const forbidden=["historia-musica","wow-wrapped","hombre-cubo","el-capo","kit/marcas/la-mafia-ia"];
function walk(dir) {
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    if ([".git","node_modules"].includes(e.name)) continue;
    const p=path.join(dir,e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(md|js|mjs|json|html|css)$/.test(e.name)) {
      const t=fs.readFileSync(p,"utf8");
      for (const f of forbidden) if (t.includes(f)) { console.error(`Forbidden private reference ${f}: ${path.relative(ROOT,p)}`); bad=true; }
    }
  }
}
walk(ROOT);
if (bad) process.exit(1);
console.log("Public distribution checks passed.");
