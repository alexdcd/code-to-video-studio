import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { resolveProjectsRoot } from "./lib/project-paths.mjs";
import { copyKit } from "./kit-copy.mjs";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const [template,name]=process.argv.slice(2);
if (!template || !name) {
  const names=fs.readdirSync(path.join(ROOT,"templates")).filter(x=>!x.startsWith("_"));
  throw new Error(`Usage: pnpm run new <template> <name>\nTemplates: ${names.join(", ")}`);
}
if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error("Project name must use lowercase letters, numbers and hyphens.");
const templateDir=path.join(ROOT,"templates",template);
if (!fs.existsSync(templateDir) || template.startsWith("_")) throw new Error(`Unknown template: ${template}`);
const projectsRoot=resolveProjectsRoot(ROOT);
fs.mkdirSync(projectsRoot,{recursive:true});
const dest=path.join(projectsRoot,name);
if (fs.existsSync(dest)) throw new Error(`Project already exists: ${dest}`);
fs.mkdirSync(dest);
fs.cpSync(templateDir,dest,{recursive:true,filter:source=>path.resolve(source)!==path.join(templateDir,"resource.json")});

const common=path.join(ROOT,"templates/_common");
for (const file of fs.readdirSync(common)) {
  const to=path.join(dest,file);
  if (!fs.existsSync(to)) fs.copyFileSync(path.join(common,file),to);
}
const version=fs.readFileSync(path.join(ROOT,"kit/VERSION"),"utf8").trim();
const date=new Date().toISOString().slice(0,10);
const replacements={ "{{NAME}}":name, "{{NOMBRE}}":name, "{{DATE}}":date, "{{FECHA}}":date, "{{KIT}}":version, "{{TEMPLATE}}":template };
const textExt=new Set([".md",".json",".html",".js",".css"]);
function walk(dir) {
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const p=path.join(dir,entry.name);
    if (entry.isDirectory()) walk(p);
    else if (textExt.has(path.extname(entry.name))) {
      let s=fs.readFileSync(p,"utf8");
      for (const [a,b] of Object.entries(replacements)) s=s.split(a).join(b);
      fs.writeFileSync(p,s);
    }
  }
}
walk(dest);
// Reuse the canonical path retargeter, keeping instructions valid outside the repository.
const retarget=spawnSync(process.execPath,[path.join(ROOT,"scripts/lib/project-paths.mjs"),"retarget",dest],{
  cwd:ROOT,stdio:"inherit",shell:false
});
if (retarget.error) throw retarget.error;
if (retarget.status!==0) throw new Error(`Could not adjust Studio references for ${dest}`);
copyKit(dest);
console.log(`Created ${dest} from ${template}`);
console.log(`Next: pnpm run dev ${name}`);
