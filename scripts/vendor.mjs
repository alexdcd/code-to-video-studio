// Public-compatible vendor adapter. Kept in the canonical Studio so public-sync
// can publish the matching script without copying the private Bash vendor setup.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");

export function vendor() {
  const gsapSource=path.join(ROOT,"node_modules/gsap/dist");
  if (!fs.existsSync(path.join(gsapSource,"gsap.min.js"))) throw new Error("GSAP not installed. Run npm install first.");

  const vendorRoot=path.join(ROOT,"kit/lib/vendor");
  fs.rmSync(vendorRoot,{recursive:true,force:true});

  const gsapDest=path.join(vendorRoot,"gsap");
  fs.mkdirSync(gsapDest,{recursive:true});
  for (const name of ["gsap.min.js","TextPlugin.min.js","MotionPathPlugin.min.js"]) {
    const from=path.join(gsapSource,name);
    if (fs.existsSync(from)) fs.copyFileSync(from,path.join(gsapDest,name));
  }

  const threeSource=path.join(ROOT,"node_modules/three");
  const threeDest=path.join(vendorRoot,"three");
  if (!fs.existsSync(path.join(threeSource,"build/three.module.js"))) throw new Error("Three.js not installed. Run npm install first.");
  fs.mkdirSync(threeDest,{recursive:true});
  fs.copyFileSync(path.join(threeSource,"build/three.module.js"),path.join(threeDest,"three.module.js"));
  const addons=path.join(threeSource,"examples/jsm");
  if (fs.existsSync(addons)) fs.cpSync(addons,path.join(threeDest,"addons"),{recursive:true});

  const lottieSource=path.join(ROOT,"node_modules/lottie-web");
  const lottieRuntime=path.join(lottieSource,"build/player/lottie_svg.min.js");
  const lottieLicense=path.join(lottieSource,"LICENSE.md");
  if (!fs.existsSync(lottieRuntime) || !fs.existsSync(lottieLicense)) throw new Error("lottie-web not installed. Run npm install first.");
  const lottieDest=path.join(vendorRoot,"lottie");
  fs.mkdirSync(lottieDest,{recursive:true});
  fs.copyFileSync(lottieRuntime,path.join(lottieDest,"lottie_svg.min.js"));
  fs.copyFileSync(lottieLicense,path.join(lottieDest,"LICENSE.md"));

  console.log("Vendored local GSAP + Three.js + Lottie runtimes from node_modules.");
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) vendor();
