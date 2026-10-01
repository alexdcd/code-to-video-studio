import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const SELF=path.resolve(fileURLToPath(import.meta.url));

const required=[
  "README.md","AGENTS.md","LICENSE","THIRD_PARTY_NOTICES.md",
  "skills/README.md","skills/registry.json","skills/mafia-ai-character-creator/SKILL.md","skills/mafia-ai-character-creator/DISTRIBUTION-MANIFEST.json","scripts/skills.mjs","scripts/package_skill.py",
  "kit/VERSION","kit/lib/mafia.js","kit/lib/cartoon-motion.js","kit/lib/three-desenfoque.js","kit/lib/three-anotaciones.js",
  "kit/styles/starter/starter.css","kit/characters/signal/signal.js",
  "templates/starter-9x16/index.html","proyectos/demo/index.html","scripts/lib/qa-video.py","tools/sfx/candidates.py","tools/sfx/clean.sh"
];

let bad=false;
for (const rel of required) {
  if (!fs.existsSync(path.join(ROOT,rel))) {
    console.error("Missing:",rel);
    bad=true;
  }
}

// Split literals so this verifier does not match itself.
const forbidden=[
  ["historia","musica"].join("-"),
  ["wow","wrapped"].join("-"),
  ["hombre","cubo"].join("-"),
  ["el","capo"].join("-"),
  ["kit","marcas","la-mafia-ia"].join("/"),
  ["yue","2"].join("")
];

function walk(dir) {
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    if ([".git","node_modules"].includes(e.name)) continue;
    const p=path.join(dir,e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(md|js|mjs|json|html|css)$/.test(e.name)) {
      if (path.resolve(p)===SELF) continue;
      const t=fs.readFileSync(p,"utf8").toLowerCase();
      for (const f of forbidden) {
        if (t.includes(f.toLowerCase())) {
          console.error(`Forbidden private reference ${f}: ${path.relative(ROOT,p)}`);
          bad=true;
        }
      }
      if (/api[_-]?key\s*[:=]\s*["'][^"']+["']/i.test(t)) {
        console.error("Possible hard-coded API key:",path.relative(ROOT,p));
        bad=true;
      }
    }
  }
}

walk(ROOT);
const skillCheck=spawnSync(process.execPath,[path.join(ROOT,"scripts/skills.mjs"),"validate","mafia-ai-character-creator"],{stdio:"inherit"});
if (skillCheck.status!==0) bad=true;
if (bad) process.exit(1);
console.log("Public distribution checks passed.");
