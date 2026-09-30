import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyKit } from "./kit-copy.mjs";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const [template,name]=process.argv.slice(2);
if (!template || !name) {
  const names=fs.readdirSync(path.join(ROOT,"templates")).filter(x=>!x.startsWith("_"));
  throw new Error(`Usage: npm run new -- <template> <name>\nTemplates: ${names.join(", ")}`);
}
if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error("Project name must use lowercase letters, numbers and hyphens.");
const templateDir=path.join(ROOT,"templates",template);
if (!fs.existsSync(templateDir) || template.startsWith("_")) throw new Error(`Unknown template: ${template}`);
const dest=path.join(ROOT,"proyectos",name);
if (fs.existsSync(dest)) throw new Error(`Project already exists: proyectos/${name}`);
fs.mkdirSync(dest,{recursive:true});
fs.cpSync(templateDir,dest,{recursive:true});

const common=path.join(ROOT,"templates/_common");
for (const file of fs.readdirSync(common)) {
  const to=path.join(dest,file);
  if (!fs.existsSync(to)) fs.copyFileSync(path.join(common,file),to);
}
const version=fs.readFileSync(path.join(ROOT,"kit/VERSION"),"utf8").trim();
const date=new Date().toISOString().slice(0,10);
const replacements={ "{{NAME}}":name, "{{DATE}}":date, "{{KIT}}":version, "{{TEMPLATE}}":template };
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
copyKit(path.relative(ROOT,dest));
console.log(`Created proyectos/${name} from ${template}`);
console.log(`Next: npm run dev -- ${name}`);
