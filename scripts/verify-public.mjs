import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const SELF=path.resolve(fileURLToPath(import.meta.url));

const required=[
  "README.md","AGENTS.md","LICENSE","THIRD_PARTY_NOTICES.md",
  "skills/README.md","skills/registry.json","skills/mafia-ai-character-creator/SKILL.md","skills/mafia-ai-character-creator/DISTRIBUTION-MANIFEST.json","scripts/skills.mjs","scripts/package_skill.py",
  "kit/VERSION","kit/lib/mafia.js","kit/lib/cartoon-motion.js","kit/lib/three-desenfoque.js","kit/lib/three-anotaciones.js","kit/lib/boceto.js","kit/lib/fisica.js","kit/lib/fx.js",
  "kit/styles/starter/starter.css","kit/styles/registry.json",
  "kit/styles/cuaderno-vibrante/cuaderno-vibrante.js","kit/styles/cuaderno-vibrante/GUIA.md",
  "kit/styles/editorial-motion/editorial-motion.js","kit/styles/editorial-motion/GUIA.md",
  "kit/fonts/inter.css","kit/fonts/OFL.txt","kit/lib/vendor/gsap/MorphSVGPlugin.min.js",
  "kit/characters/signal/signal.js",
  "templates/starter-9x16/index.html","templates/starter-9x16/resource.json",
  "templates/cuaderno-vibrante-9x16/index.html","templates/editorial-motion-16x9/index.html","templates/editorial-motion-9x16/index.html",
  "proyectos/demo/index.html","scripts/lib/qa-video.py","scripts/web-encode.mjs","scripts/sfx-clean.mjs","tools/sfx/candidates.py","tools/sfx/clean.sh"
];

let bad=false;
for (const rel of required) {
  if (!fs.existsSync(path.join(ROOT,rel))) {
    console.error("Missing:",rel);
    bad=true;
  }
}

const gsapPackagePath=path.join(ROOT,"node_modules/gsap/package.json");
const morphNpmPath=path.join(ROOT,"node_modules/gsap/dist/MorphSVGPlugin.min.js");
const morphRuntimePath=path.join(ROOT,"kit/lib/vendor/gsap/MorphSVGPlugin.min.js");
if (!fs.existsSync(gsapPackagePath)) {
  console.error("Missing node_modules/gsap/package.json; reinstall dependencies with pnpm install --frozen-lockfile.");
  bad=true;
} else {
  const gsapPackage=JSON.parse(fs.readFileSync(gsapPackagePath,"utf8"));
  if (gsapPackage.version!=="3.15.0") {
    console.error(`Expected gsap@3.15.0, found gsap@${gsapPackage.version}. Reinstall dependencies with pnpm install --frozen-lockfile.`);
    bad=true;
  }
}
if (!fs.existsSync(morphNpmPath)) {
  console.error("MorphSVGPlugin is missing from gsap@3.15.0; reinstall the pinned dependency with pnpm install --frozen-lockfile.");
  bad=true;
}
if (!fs.existsSync(morphRuntimePath)) {
  console.error("MorphSVGPlugin is missing from the local runtime; run pnpm run setup.");
  bad=true;
} else if (fs.existsSync(morphNpmPath)) {
  const npmMorph=fs.readFileSync(morphNpmPath);
  const runtimeMorph=fs.readFileSync(morphRuntimePath);
  if (!runtimeMorph.equals(npmMorph)) {
    console.error("The local MorphSVG runtime does not match the installed gsap@3.15.0 package; run pnpm run setup.");
    bad=true;
  }
  const runtimeText=runtimeMorph.toString("utf8");
  if (!runtimeText.includes("MorphSVGPlugin") || !runtimeText.includes('version:"3.15.0"')) {
    console.error("The local MorphSVG runtime is not the real gsap@3.15.0 plugin.");
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
const skillCheck=spawnSync(process.execPath,[path.join(ROOT,"scripts/skills.mjs"),"validate","--tier","public"],{stdio:"inherit"});
if (skillCheck.status!==0) bad=true;
if (bad) process.exit(1);
console.log("Public distribution checks passed.");
