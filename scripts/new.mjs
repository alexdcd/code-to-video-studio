import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyKit } from "./kit-copy.mjs";
import { resolveProjectsRoot, validateProjectsRoot } from "./lib/project-paths.mjs";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const NAME_RE=/^[a-z0-9][a-z0-9-]*$/;
const TEXT_EXT=new Set([".md",".json",".html",".js",".css"]);

export function createProject({template,name,studioRoot=ROOT,projectsRoot,copyKitFn=copyKit}={}) {
  if (!template || !name) throw new Error("Template and project name are required.");
  if (!NAME_RE.test(name)) throw new Error("Project name must use lowercase letters, numbers and hyphens.");
  const templateDir=path.join(studioRoot,"templates",template);
  if (!fs.existsSync(templateDir) || template.startsWith("_")) throw new Error(`Unknown template: ${template}`);
  const root=projectsRoot ? validateProjectsRoot(studioRoot,projectsRoot) : resolveProjectsRoot(studioRoot);
  fs.mkdirSync(root,{recursive:true});
  const dest=path.join(root,name);
  if (fs.existsSync(dest)) throw new Error(`Project already exists: ${dest}`);
  fs.mkdirSync(dest,{recursive:true});
  try {
    fs.cpSync(templateDir,dest,{recursive:true,filter:source=>path.resolve(source)!==path.join(templateDir,"resource.json")});
    const common=path.join(studioRoot,"templates/_common");
    for (const file of fs.readdirSync(common)) {
      const to=path.join(dest,file);
      if (!fs.existsSync(to)) fs.copyFileSync(path.join(common,file),to);
    }
    const version=fs.readFileSync(path.join(studioRoot,"kit/VERSION"),"utf8").trim();
    const date=new Date().toISOString().slice(0,10);
    const replacements={ "{{NAME}}":name, "{{DATE}}":date, "{{KIT}}":version, "{{TEMPLATE}}":template };
    function walk(dir) {
      for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
        const file=path.join(dir,entry.name);
        if (entry.isDirectory()) walk(file);
        else if (TEXT_EXT.has(path.extname(entry.name))) {
          let value=fs.readFileSync(file,"utf8");
          for (const [from,to] of Object.entries(replacements)) value=value.split(from).join(to);
          fs.writeFileSync(file,value);
        }
      }
    }
    walk(dest);
    copyKitFn(dest);
    return dest;
  } catch (error) {
    fs.rmSync(dest,{recursive:true,force:true});
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const [template,name]=process.argv.slice(2);
    if (!template || !name) {
      const names=fs.readdirSync(path.join(ROOT,"templates")).filter(x=>!x.startsWith("_"));
      throw new Error(`Usage: pnpm run new <template> <name>\nTemplates: ${names.join(", ")}`);
    }
    const dest=createProject({template,name});
    console.log(`Created ${dest} from ${template}`);
    console.log(`Next: pnpm run dev ${name}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode=1;
  }
}
