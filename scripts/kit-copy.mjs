import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildKit } from "./lib/kit-build.mjs";
import { vendor } from "./vendor.mjs";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");

export function copyKit(projectPath) {
  const project=path.resolve(ROOT,projectPath);
  if (!fs.existsSync(path.join(project,"index.html"))) throw new Error(`No index.html in ${projectPath}`);
  if (!fs.existsSync(path.join(ROOT,"kit/lib/vendor/gsap/gsap.min.js"))) vendor();
  const {version}=buildKit();
  const dest=path.join(project,"assets/kit");
  fs.rmSync(dest,{recursive:true,force:true});
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.cpSync(path.join(ROOT,"kit"),dest,{recursive:true});
  const meta=path.join(project,"meta.json");
  if (fs.existsSync(meta)) {
    const data=JSON.parse(fs.readFileSync(meta,"utf8"));
    data.kit=version;
    fs.writeFileSync(meta,JSON.stringify(data,null,2)+"\n");
  }
  return version;
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const target=process.argv[2];
  if (!target) throw new Error("Usage: node scripts/kit-copy.mjs proyectos/<name>");
  const v=copyKit(target);
  console.log(`Kit ${v} copied to ${target}/assets/kit`);
}
