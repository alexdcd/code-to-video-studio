import {
  closeSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { appendLedger, checkLedger } from "../render-version-ledger.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function statIfPresent(file) {
  try {
    return lstatSync(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function ensureRenderDirectory(projectDir) {
  const projectRoot = realpathSync(projectDir);
  if (!statIfPresent(path.join(projectRoot, "index.html"))?.isFile()) {
    throw new Error(`No encuentro index.html en ${projectRoot}`);
  }

  const renders = path.resolve(projectRoot, "renders");
  if (!statIfPresent(renders)) mkdirSync(renders, { recursive: true });
  const rendersStat = statIfPresent(renders);
  if (!rendersStat?.isDirectory() || rendersStat.isSymbolicLink()) {
    throw new Error("No se puede renderizar: renders/ no puede ser un symlink.");
  }
  const canonicalRenders = realpathSync(renders);
  if (canonicalRenders !== renders) {
    throw new Error("No se puede renderizar: renders/ debe permanecer dentro del proyecto.");
  }
  return { projectRoot, renders: canonicalRenders };
}

function reserveVersion(renders, projectName) {
  for (let number = 1; ; number += 1) {
    const version = `v${String(number).padStart(2, "0")}`;
    const master = path.join(renders, `${projectName}-${version}.mp4`);
    const redes = path.join(renders, `${projectName}-${version}-redes.mp4`);
    let occupied = false;

    for (const output of [master, redes]) {
      const stat = statIfPresent(output);
      if (stat?.isSymbolicLink()) {
        throw new Error(`No se puede renderizar: una ruta de salida ya es un symlink (${path.basename(output)}).`);
      }
      if (stat) occupied = true;
    }
    if (occupied) continue;

    const lock = path.join(renders, `.render-${version}.lock`);
    let lockFd;
    try {
      lockFd = openSync(lock, "wx", 0o600);
    } catch (error) {
      if (error.code === "EEXIST") continue;
      throw error;
    }

    try {
      const opened = fstatSync(lockFd);
      const current = lstatSync(lock);
      if (!opened.isFile() || opened.nlink !== 1 || current.isSymbolicLink()
        || opened.dev !== current.dev || opened.ino !== current.ino) {
        throw new Error("No se puede reservar la versión del render de forma segura.");
      }
      if (statIfPresent(master) || statIfPresent(redes)) {
        closeSync(lockFd);
        lockFd = undefined;
        unlinkSync(lock);
        continue;
      }
      return { version, master, redes, lock, lockFd };
    } catch (error) {
      if (lockFd !== undefined) closeSync(lockFd);
      try { unlinkSync(lock); } catch (unlinkError) { if (unlinkError.code !== "ENOENT") throw unlinkError; }
      throw error;
    }
  }
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: false });
  if (result.error) throw new Error(`No se pudo ejecutar ${command}: ${result.error.message}`);
  return result.status ?? 1;
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function normalizedNote(note) {
  return String(note || "(sin nota)").replace(/[\r\n]+/g, " ").trim() || "(sin nota)";
}

export function renderProject({ projectDir, hyperframesBin, hyperframesArgs = [], note = "", redesCrf = process.env.REDES_CRF || "22" }) {
  if (!/^(?:18|19|20|21|22|23|24)$/.test(String(redesCrf))) {
    throw new Error("REDES_CRF debe ser un entero entre 18 y 24.");
  }
  if (hyperframesArgs.some((arg) => arg === "--output" || arg.startsWith("--output=") || arg === "-o" || arg.startsWith("-o="))) {
    throw new Error("No se puede cambiar --output en un render numerado.");
  }

  const { projectRoot, renders } = ensureRenderDirectory(projectDir);
  const ledger = path.join(renders, "VERSIONES.txt");
  checkLedger(ledger, projectRoot);
  const reservation = reserveVersion(renders, path.basename(projectRoot));

  try {
    const ffmpegCheck = spawnSync("ffmpeg", ["-version"], { stdio: "ignore", shell: false });
    if (ffmpegCheck.error || ffmpegCheck.status !== 0) {
      throw new Error("Falta ffmpeg o no se puede ejecutar.");
    }
    if (!hyperframesBin || !path.isAbsolute(hyperframesBin)) {
      throw new Error("No se encontró el ejecutable de HyperFrames.");
    }

    const masterStatus = run(hyperframesBin, [
      "render", "--output", path.join("renders", path.basename(reservation.master)),
      "--browser-timeout", "120", ...hyperframesArgs,
    ], projectRoot);
    if (masterStatus !== 0) return { status: masterStatus, ...reservation };

    const redesStatus = run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-n", "-i", reservation.master,
      "-c:v", "libx264", "-preset", "slow", "-crf", String(redesCrf),
      "-maxrate", "16M", "-bufsize", "32M", "-pix_fmt", "yuv420p", "-profile:v", "high",
      "-movflags", "+faststart", "-c:a", "aac", "-b:a", "192k", reservation.redes,
    ], projectRoot);
    if (redesStatus !== 0) return { status: redesStatus, ...reservation };

    appendLedger(ledger, projectRoot, `${reservation.version} · ${localDate()} · ${normalizedNote(note)} · redes CRF ${redesCrf}`);
    console.log(`→ ${path.relative(projectRoot, reservation.master)}`);
    console.log(`→ ${path.relative(projectRoot, reservation.redes)}`);
    return { status: 0, ...reservation };
  } finally {
    closeSync(reservation.lockFd);
    try { unlinkSync(reservation.lock); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}

function main() {
  const [projectDir = ".", note = "", separator, ...hyperframesArgs] = process.argv.slice(2);
  if (separator !== "--") {
    console.error("Uso: render-pipeline.mjs <proyecto> [nota] -- [opciones de HyperFrames]");
    process.exitCode = 2;
    return;
  }
  const hyperframesBin = path.join(ROOT, "node_modules/.bin", process.platform === "win32" ? "hyperframes.cmd" : "hyperframes");
  try {
    const result = renderProject({ projectDir, note, hyperframesBin, hyperframesArgs });
    process.exitCode = result.status;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
