import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");

export function vendor() {
  const source=path.join(ROOT,"node_modules/gsap/dist");
  if (!fs.existsSync(path.join(source,"gsap.min.js"))) throw new Error("GSAP not installed. Run npm install first.");
  const dest=path.join(ROOT,"kit/lib/vendor/gsap");
  fs.rmSync(path.join(ROOT,"kit/lib/vendor"),{recursive:true,force:true});
  fs.mkdirSync(dest,{recursive:true});
  for (const name of ["gsap.min.js","TextPlugin.min.js","MotionPathPlugin.min.js"]) {
    const from=path.join(source,name);
    if (fs.existsSync(from)) fs.copyFileSync(from,path.join(dest,name));
  }
  console.log("Vendored local GSAP runtime from node_modules.");
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) vendor();
