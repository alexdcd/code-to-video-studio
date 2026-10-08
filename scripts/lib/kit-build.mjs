import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const KIT = path.join(ROOT, "kit");

function list(dir, pattern) {
  const base = path.join(KIT, dir);
  if (!fs.existsSync(base)) return [];
  const out = [];
  for (const entry of fs.readdirSync(base,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    const p=path.join(base,entry.name);
    if (entry.isDirectory()) {
      for (const f of fs.readdirSync(p).sort()) if (pattern.test(f)) out.push(path.join(p,f));
    } else if (pattern.test(entry.name)) out.push(p);
  }
  return out;
}

export function buildKit() {
  const version=fs.readFileSync(path.join(KIT,"VERSION"),"utf8").trim();
  const sources=[
    path.join(KIT,"lib/mafia.js"),
    path.join(KIT,"lib/cartoon-motion.js"),
    path.join(KIT,"lib/boceto.js"),
    path.join(KIT,"lib/fisica.js"),
    path.join(KIT,"lib/fx.js"),
    ...list("styles",/\.js$/),
    ...list("characters",/\.js$/)
  ];
  for (const file of sources) {
    const text=fs.readFileSync(file,"utf8");
    const bad=["</script","<script","<!--"].find(x=>text.toLowerCase().includes(x));
    if (bad) throw new Error(`${path.relative(ROOT,file)} contains ${bad}, unsafe for HyperFrames inline assembly`);
  }
  fs.mkdirSync(path.join(KIT,"dist"),{recursive:true});
  let out=`/* Code to Video Studio kit v${version} · generated. Edit source files, not this bundle. */\n`;
  for (const file of sources) out += `\n/* ==== ${path.relative(KIT,file)} ==== */\n${fs.readFileSync(file,"utf8")}\n`;
  out += `\nwindow.MAFIA.version=${JSON.stringify(version)};\n`;
  fs.writeFileSync(path.join(KIT,"dist/mafia-kit.js"),out);
  return {version,sources:sources.length};
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const r=buildKit();
  console.log(`Kit ${r.version}: ${r.sources} JS modules → kit/dist/mafia-kit.js`);
}
