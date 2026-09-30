import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { vendor } from "./vendor.mjs";
import { buildKit } from "./lib/kit-build.mjs";
import { copyKit } from "./kit-copy.mjs";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
vendor();
const r=buildKit();
const projects=path.join(ROOT,"proyectos");
if (fs.existsSync(projects)) {
  for (const name of fs.readdirSync(projects).sort()) {
    if (fs.existsSync(path.join(projects,name,"index.html"))) copyKit(path.join("proyectos",name));
  }
}
console.log(`Code to Video Studio ready · kit ${r.version}`);
