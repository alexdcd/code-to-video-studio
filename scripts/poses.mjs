#!/usr/bin/env node
// Poses clave por escena, sin renderizar el vídeo. Con --round guarda evidencia inmutable de revisión.
// Uso: pnpm run poses <proyecto> [--at 1.25,2.5] [--scene s01,s03] [--round 00|01|02|03]
//      pnpm run poses <proyecto> --verify-round 00
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readSceneTimes } from "./lib/scene-times.mjs";
import { resolveProjectPath } from "./lib/project-paths.mjs";
import {
  buildPoseComparisonLabelFilter,
  buildPoseLabelFilter,
  diffStoryboardInputs,
  hashStoryboardInputs,
  parsePoseArgs,
  planPoseShots,
  setAsideIncompleteRound,
  storyboardRoundPaths,
  verifyRoundEvidence,
  writeEvidenceManifest,
} from "./lib/pose-evidence.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HF = path.join(ROOT, "node_modules", "hyperframes", "bin", "hyperframes.mjs");

// Solo si ESTA ejecución creó la carpeta .in-progress: nunca se aparta la de otra captura en curso o interrumpida.
let createdPending = null;

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed: ${result.error?.message || result.stderr || result.stdout}`);
  return result;
}

function shotKey(shot) {
  const scene = (shot.sceneIds ?? [shot.scene]).join("+");
  return `${scene}\u0000${shot.kind}\u0000${Number(shot.seconds).toFixed(3)}`;
}

async function readPriorShots(projectDir, roundNumber) {
  const rounds = [];
  for (let previous = roundNumber - 1; previous >= 0; previous--) {
    const round = String(previous).padStart(2, "0");
    const validation = await verifyRoundEvidence(projectDir, round);
    if (validation.status === "UNKNOWN") continue;
    const directory = storyboardRoundPaths(projectDir, round).finalDir;
    const manifestPath = path.join(directory, "evidence-manifest.json");
    const posesPath = path.join(directory, "poses.json");
    if (!fs.existsSync(manifestPath) || !fs.existsSync(posesPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const poses = JSON.parse(fs.readFileSync(posesPath, "utf8"));
      if (manifest.schemaVersion !== 1 || manifest.round !== round || !Array.isArray(manifest.shots)
        || !Array.isArray(poses.shots) || poses.shots.length !== manifest.shots.length) continue;
      const filesValid = manifest.evidenceFiles?.every(item => {
        if (typeof item.path !== "string" || path.isAbsolute(item.path) || item.path.includes("\\") || item.path.split("/").includes("..")) return false;
        const image = path.resolve(directory, item.path);
        return image.startsWith(`${directory}${path.sep}`) && fs.existsSync(image)
          && fs.lstatSync(image).isFile() && !fs.lstatSync(image).isSymbolicLink();
      });
      if (!filesValid) continue;
      rounds.push({ round, directory, shots: manifest.shots });
    } catch {
      continue;
    }
  }
  return rounds;
}

async function makeComparisons(projectDir, outDir, round, shots) {
  const previousRounds = await readPriorShots(projectDir, Number(round));
  if (!previousRounds.length) return [];
  const matches = shots.map(shot => {
    for (const previous of previousRounds) {
      const before = previous.shots.find(candidate => shotKey(candidate) === shotKey(shot));
      if (before) return { shot, before, previous };
    }
    return null;
  }).filter(Boolean);
  if (!matches.length) return [];
  const comparisonDir = path.join(outDir, "comparisons");
  fs.mkdirSync(comparisonDir, { recursive: true });
  return matches.map(({ shot, before, previous }, index) => {
    const filename = `before-after-${String(index + 1).padStart(3, "0")}.jpg`;
    const beforeImage = path.resolve(previous.directory, before.path);
    const afterImage = path.resolve(outDir, shot.frame);
    const filter = `${buildPoseComparisonLabelFilter(0, "before", "BEFORE")};${buildPoseComparisonLabelFilter(1, "after", "AFTER")};[before][after]hstack=inputs=2[out]`;
    run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-i", beforeImage, "-i", afterImage,
      "-filter_complex", filter, "-map", "[out]", "-frames:v", "1", "-q:v", "3", path.join(comparisonDir, filename),
    ], projectDir);
    return {
      path: `comparisons/${filename}`,
      scene: shot.scene,
      ...(shot.sceneIds ? { sceneIds: shot.sceneIds } : {}),
      kind: shot.kind,
      seconds: shot.seconds,
      beforeRound: previous.round,
      beforePath: path.posix.join("..", `round-${previous.round}`, before.path),
      afterPath: shot.frame,
    };
  });
}

async function verifyRound(projectDir, round) {
  const result = await verifyRoundEvidence(projectDir, round);
  console.log(`${result.status}: storyboard evidence round ${String(round).padStart(2, "0")}${result.reason ? ` — ${result.reason}` : ""}`);
  if (result.status !== "FRESH") process.exitCode = 2;
}

async function capture(projectDir, args) {
  const { duration, scenes: allScenes } = readSceneTimes(projectDir);
  if (!allScenes.length) throw new Error("La línea de tiempo no tiene escenas (pistas de gráficos con inicio y fin).");
  const plan = planPoseShots(allScenes, {
    at: args.at,
    sceneIds: args.sceneIds,
    duration,
    deduplicateBaseline: args.hasCaptureOptions,
  });
  if (args.round === "03" && plan.coverage !== "all") {
    throw new Error("Round 03 is reserved for a complete final capture; omit --scene and capture every scene.");
  }
  const { scenes, shots } = plan;
  const roundPaths = args.round ? storyboardRoundPaths(projectDir, args.round, { createParent: true }) : null;
  if (roundPaths) {
    if (fs.existsSync(roundPaths.finalDir)) throw new Error(`Round ${args.round} already exists; evidence is never overwritten.`);
    if (fs.existsSync(roundPaths.pendingDir)) throw new Error(`Round ${args.round} has an incomplete .in-progress capture; inspect it before retrying.`);
    fs.mkdirSync(roundPaths.pendingDir);
    createdPending = { projectDir, round: args.round };
  }

  const outDir = roundPaths?.pendingDir ?? path.join(projectDir, "renders", "poses");
  const rawDir = path.join(outDir, "capturas");
  if (!roundPaths) {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(rawDir, { recursive: true });
  } else {
    fs.mkdirSync(rawDir, { recursive: true });
  }
  const inputsBefore = roundPaths ? await hashStoryboardInputs(projectDir) : null;

  run(process.execPath, [HF,
    "snapshot", "--at", shots.map(shot => shot.seconds).join(","), "--no-end", "--describe", "false",
    "--timeout", "20000", "-o", rawDir, ".",
  ], projectDir);

  const files = fs.readdirSync(rawDir).filter(name => /^frame-\d+-at-.*\.png$/.test(name))
    .sort((a, b) => Number(a.match(/^frame-(\d+)/)[1]) - Number(b.match(/^frame-(\d+)/)[1]));
  if (files.length !== shots.length) throw new Error(`Esperaba ${shots.length} capturas y hay ${files.length}.`);

  const labelled = path.join(outDir, "etiquetadas");
  fs.mkdirSync(labelled, { recursive: true });
  shots.forEach((shot, index) => {
    const label = `${shot.scene} · ${shot.kind} · ${shot.seconds.toFixed(2)} s`.replace(/[':\\]/g, " ");
    run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-i", path.join(rawDir, files[index]),
      "-vf", buildPoseLabelFilter(label, { separateHeader: Boolean(roundPaths) }),
      "-q:v", "3", path.join(labelled, `p-${String(index + 1).padStart(3, "0")}.jpg`),
    ], projectDir);
    shot.frame = `capturas/${files[index]}`;
  });

  const columns = 4;
  const rows = Math.ceil(shots.length / columns);
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-framerate", "1", "-i", path.join(labelled, "p-%03d.jpg"),
    "-vf", `tile=${columns}x${rows}:padding=6:margin=6:color=0x111111`, "-frames:v", "1", "-q:v", "3",
    path.join(outDir, "hoja.jpg"),
  ], projectDir);
  fs.rmSync(labelled, { recursive: true, force: true });
  fs.writeFileSync(path.join(outDir, "poses.json"), `${JSON.stringify({ schemaVersion: 1, scenes, shots }, null, 2)}\n`, "utf8");

  if (roundPaths) {
    const comparisons = await makeComparisons(projectDir, outDir, args.round, shots);
    const inputsAfter = await hashStoryboardInputs(projectDir);
    if (inputsAfter.digest !== inputsBefore.digest) {
      const changed = diffStoryboardInputs(inputsBefore, inputsAfter);
      throw new Error(`Storyboard inputs changed while snapshots were being generated: ${changed.slice(0, 6).join(", ")}${changed.length > 6 ? ", …" : ""}. The round was not finalized.`);
    }
    await writeEvidenceManifest(projectDir, args.round, {
      shots,
      coverage: plan.coverage,
      requestedInstants: plan.requestedInstants,
      comparisons,
      directory: roundPaths.pendingDir,
      expectedSourceDigest: inputsBefore.digest,
    });
    fs.renameSync(roundPaths.pendingDir, roundPaths.finalDir);
  }

  console.log(`Poses: ${scenes.length} escenas, ${shots.length} capturas → ${roundPaths
    ? path.relative(ROOT, path.join(roundPaths.finalDir, "hoja.jpg"))
    : path.relative(ROOT, path.join(outDir, "hoja.jpg"))}`);
  if (roundPaths) console.log(`Evidencia conservada en ${path.relative(ROOT, roundPaths.finalDir)}${plan.coverage === "selected" ? " (selected scene coverage)" : ""}.`);
}

async function main() {
  const args = parsePoseArgs(process.argv.slice(2));
  const projectDir = resolveProjectPath(args.project, { studioRoot: ROOT });
  if (args.verifyRound) return verifyRound(projectDir, args.verifyRound);
  return capture(projectDir, args);
}

main().catch(error => {
  console.error(error.message);
  if (createdPending) {
    // Una captura fallida no bloquea el reintento: su carpeta se aparta (no se borra) para inspeccionarla.
    try {
      const moved = setAsideIncompleteRound(createdPending.projectDir, createdPending.round);
      if (moved) console.error(`Captura parcial conservada en ${path.relative(ROOT, moved)}. Puedes repetir el mismo comando.`);
    } catch (moveError) {
      console.error(`No se pudo apartar la captura incompleta: ${moveError.message}`);
    }
  }
  process.exitCode = 1;
});
