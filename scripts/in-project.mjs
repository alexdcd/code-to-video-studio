import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { renderProject } from "./lib/render-pipeline.mjs";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const [action,project,...rest]=process.argv.slice(2);
if (!action || !project) throw new Error("Usage: node scripts/in-project.mjs <dev|check|render|snapshot> <project> [...args]");
let dir=path.join(ROOT,"proyectos",project);
if (!fs.existsSync(path.join(dir,"index.html"))) dir=path.resolve(ROOT,project);
if (!fs.existsSync(path.join(dir,"index.html"))) throw new Error("Project not found: "+project);
const bin=path.join(ROOT,"node_modules/.bin",process.platform==="win32"?"hyperframes.cmd":"hyperframes");
if (!fs.existsSync(bin)) throw new Error("HyperFrames not installed. Run pnpm install.");

if (action==="render") {
  let note="";
  if (rest.length && !rest[0].startsWith("-")) note=rest.shift();
  const result=renderProject({projectDir:dir,hyperframesBin:bin,hyperframesArgs:rest,note});
  process.exitCode=result.status;
} else {
  const args=action==="dev" ? ["preview",...rest] : [action,...rest];
  const result=spawnSync(bin,args,{cwd:dir,stdio:"inherit",shell:false});
  process.exit(result.status ?? 1);
}
