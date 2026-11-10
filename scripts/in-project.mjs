import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { renderProject } from "./lib/render-pipeline.mjs";
import { resolveProjectPath } from "./lib/project-paths.mjs";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const [action,project,...rest]=process.argv.slice(2);
if (!action || !project) throw new Error("Usage: node scripts/in-project.mjs <dev|check|render|snapshot> <project> [...args]");
const dir=resolveProjectPath(project,{studioRoot:ROOT});
const hyperframesEntry=path.join(ROOT,"node_modules","hyperframes","bin","hyperframes.mjs");
if (!fs.existsSync(hyperframesEntry)) throw new Error("HyperFrames not installed. Run pnpm install.");

if (action==="render") {
  let note="";
  if (rest.length && !rest[0].startsWith("-")) note=rest.shift();
  const result=renderProject({projectDir:dir,hyperframesBin:[process.execPath,hyperframesEntry],hyperframesArgs:rest,note});
  process.exitCode=result.status;
} else {
  const args=action==="dev" ? ["preview",...rest] : [action,...rest];
  const result=spawnSync(process.execPath,[hyperframesEntry,...args],{cwd:dir,stdio:"inherit",shell:false});
  process.exit(result.status ?? 1);
}
