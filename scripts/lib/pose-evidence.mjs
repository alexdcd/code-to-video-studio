import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";

const ROUND_IDS = new Set(["00", "01", "02", "03"]);
const CAPTURE_VERSION = 4;
const HYPERFRAMES_VERSION = JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8")).devDependencies?.hyperframes ?? "unknown";
const STUDIO_CAPTURE_INPUTS = [
  "package.json",
  "pnpm-lock.yaml",
  "scripts/poses.mjs",
  "scripts/lib/pose-evidence.mjs",
  "scripts/lib/scene-times.mjs",
  "scripts/lib/project-paths.mjs",
];
// En la raíz del proyecto no cuentan como entrada de la captura: los resultados (renders/), el repositorio, las dependencias y el estado
// que HyperFrames escribe al mirar el proyecto (.hyperframes/: se crea o se reescribe en el propio `hyperframes snapshot`, lo que
// invalidaba la ronda mientras se capturaba). El estado de aprobaciones de meta.json tampoco cuenta (ver hashProjectFile).
const PROJECT_OUTPUTS = new Set([".git", "node_modules", "renders", ".hyperframes"]);
const ATOMIC_TEMP_FILE = /^\.meta\.json\.[^/]+\.tmp$/;

function isPathInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export function normalizeRound(value) {
  const round = String(value ?? "").padStart(2, "0");
  if (!ROUND_IDS.has(round)) throw new Error("--round must be 00, 01, 02, or 03.");
  return round;
}

function parseAtValues(value) {
  const values = String(value).split(",").map(part => part.trim());
  if (!values.length || values.some(part => !part)) throw new Error("--at needs one or more comma-separated seconds.");
  return values.map(part => {
    const seconds = Number(part);
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error(`Invalid --at time: ${part}`);
    return Number(seconds.toFixed(3));
  });
}

export function buildPoseLabelFilter(label, { separateHeader = false } = {}) {
  const safeLabel = String(label).replace(/[\\':,;=%\[\]]/g, " ");
  const drawText = `drawtext=text='${safeLabel}':x=10:y=${separateHeader ? 7 : 10}:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=5`;
  if (!separateHeader) return `scale=640:-2:flags=lanczos,${drawText}`;
  return [
    "scale=640:360:force_original_aspect_ratio=decrease",
    "pad=640:360:(ow-iw)/2:(oh-ih)/2:color=0x111111",
    "pad=640:398:0:38:color=0x111111",
    drawText,
  ].join(",");
}

export function buildPoseComparisonLabelFilter(input, output, label) {
  const safeLabel = String(label).replace(/[\\':,;=%\[\]]/g, " ");
  return `[${input}:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:color=0x111111,pad=640:398:0:38:color=0x111111,drawtext=text='${safeLabel}':x=12:y=7:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=5[${output}]`;
}

export function parsePoseArgs(args) {
  const [project, ...options] = args;
  if (!project || project.startsWith("--")) throw new Error("Uso: pnpm run poses <proyecto> [--at segundos,...] [--scene id,...] [--round 00|01|02|03] [--verify-round 00|01|02|03]");
  const parsed = { project, at: [], sceneIds: [], round: null, verifyRound: null, hasCaptureOptions: false };
  for (let index = 0; index < options.length; index++) {
    const option = options[index];
    if (!["--at", "--scene", "--round", "--verify-round"].includes(option)) throw new Error(`Unknown option ${option}.`);
    const value = options[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${option}.`);
    if (option === "--at") {
      parsed.at.push(...parseAtValues(value));
      parsed.hasCaptureOptions = true;
    } else if (option === "--scene") {
      const ids = value.split(",").map(item => item.trim());
      if (!ids.length || ids.some(id => !id)) throw new Error("--scene needs one or more non-empty comma-separated scene IDs.");
      parsed.sceneIds.push(...ids);
      parsed.hasCaptureOptions = true;
    } else if (option === "--round") {
      if (parsed.round) throw new Error("--round may be supplied only once.");
      parsed.round = normalizeRound(value);
      parsed.hasCaptureOptions = true;
    } else {
      if (parsed.verifyRound) throw new Error("--verify-round may be supplied only once.");
      parsed.verifyRound = normalizeRound(value);
    }
  }
  if (parsed.verifyRound && (parsed.hasCaptureOptions || parsed.at.length || parsed.sceneIds.length)) {
    throw new Error("--verify-round cannot be combined with capture options.");
  }
  parsed.sceneIds = [...new Set(parsed.sceneIds)];
  return parsed;
}

function sceneAtTime(scenes, seconds) {
  const matching = scenes.filter(scene => seconds >= scene.startSeconds && seconds < scene.endSeconds);
  return [...new Set(matching.map(scene => scene.id))];
}

export function planPoseShots(scenes, { at = [], sceneIds = [], duration = null, deduplicateBaseline = false } = {}) {
  if (!Array.isArray(scenes) || scenes.length === 0) throw new Error("The timeline has no scenes to capture.");
  const selectedIds = new Set(sceneIds);
  const unknownScenes = [...selectedIds].filter(id => !scenes.some(scene => scene.id === id));
  if (unknownScenes.length) throw new Error(`Unknown scene ID(s): ${unknownScenes.join(", ")}.`);
  const selectedScenes = selectedIds.size ? scenes.filter(scene => selectedIds.has(scene.id)) : scenes;
  const shots = selectedScenes.flatMap(scene => [
    { scene: scene.id, kind: "arranque", seconds: scene.openingSeconds },
    { scene: scene.id, kind: "lleno", seconds: scene.fullSeconds },
  ]);
  const limit = Number.isFinite(duration) && duration > 0
    ? duration
    : Math.max(...scenes.map(scene => scene.endSeconds));
  const requestedInstants = [];
  for (const rawSeconds of at) {
    if (!Number.isFinite(rawSeconds) || rawSeconds < 0) throw new Error(`Invalid storyboard time: ${rawSeconds}`);
    const seconds = Number(rawSeconds.toFixed(3));
    if (seconds >= limit) throw new Error(`Storyboard time ${seconds.toFixed(3)} s is outside the composition duration (${limit.toFixed(3)} s).`);
    const sceneIdsAtTime = sceneAtTime(scenes, seconds);
    if (!sceneIdsAtTime.length) throw new Error(`Storyboard time ${seconds.toFixed(3)} s does not fall within a timeline scene; add no guessed capture.`);
    const duplicate = shots.find(shot => shot.kind !== "storyboard" && Math.abs(shot.seconds - seconds) < 0.0005);
    if (duplicate) {
      requestedInstants.push({ seconds, sceneIds: sceneIdsAtTime, capture: "covered-by-existing-sample" });
      continue;
    }
    const duplicateInstant = shots.find(shot => shot.kind === "storyboard" && Math.abs(shot.seconds - seconds) < 0.0005);
    if (duplicateInstant) {
      requestedInstants.push({ seconds, sceneIds: sceneIdsAtTime, capture: "deduplicated" });
      continue;
    }
    shots.push({
      scene: sceneIdsAtTime.join(" + "),
      sceneIds: sceneIdsAtTime,
      kind: "storyboard",
      seconds,
    });
    requestedInstants.push({ seconds, sceneIds: sceneIdsAtTime, capture: "captured" });
  }
  if (deduplicateBaseline) {
    const groups = new Map();
    for (const shot of shots) {
      const key = Number(shot.seconds).toFixed(3);
      const group = groups.get(key) ?? [];
      group.push(shot);
      groups.set(key, group);
    }
    shots.splice(0, shots.length, ...[...groups.values()].map(group => {
      if (group.length === 1) return group[0];
      const samples = group.flatMap(shot => shot.samples ?? [{ scene: shot.scene, kind: shot.kind }]);
      const ids = [...new Set(group.flatMap(shot => shot.sceneIds ?? [shot.scene]))];
      const kinds = [...new Set(samples.map(sample => sample.kind))];
      return {
        scene: ids.join(" + "),
        sceneIds: ids,
        kind: kinds.join(" + "),
        seconds: group[0].seconds,
        samples,
      };
    }));
  }
  if (at.length || selectedIds.size) shots.sort((left, right) => left.seconds - right.seconds || left.scene.localeCompare(right.scene));
  return {
    scenes: selectedScenes,
    shots,
    coverage: selectedScenes.length === scenes.length ? "all" : "selected",
    requestedInstants,
  };
}

function assertNoSymlink(root, relativePath, { createDirectories = false } = {}) {
  const parts = relativePath.split(path.sep).filter(Boolean);
  let current = root;
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error?.code !== "ENOENT" || !createDirectories) throw error;
      fs.mkdirSync(current);
      stat = fs.lstatSync(current);
    }
    if (stat.isSymbolicLink()) throw new Error(`Refusing symlink in storyboard evidence path: ${current}`);
    if (index < parts.length - 1 && !stat.isDirectory()) throw new Error(`Not a directory in storyboard evidence path: ${current}`);
  }
  return current;
}

export function storyboardRoundPaths(projectDir, round, { createParent = false } = {}) {
  const normalizedRound = normalizeRound(round);
  const projectRoot = fs.realpathSync.native(projectDir);
  if (!createParent) {
    let parent = projectRoot;
    for (const part of ["renders", "storyboard-review"]) {
      parent = path.join(parent, part);
      if (!fs.existsSync(parent)) continue;
      const stat = fs.lstatSync(parent);
      if (stat.isSymbolicLink()) throw new Error(`Refusing symlink in storyboard evidence path: ${parent}`);
      if (!stat.isDirectory()) throw new Error(`Not a directory in storyboard evidence path: ${parent}`);
    }
  }
  const reviewRoot = createParent
    ? assertNoSymlink(projectRoot, path.join("renders", "storyboard-review"), { createDirectories: true })
    : path.join(projectRoot, "renders", "storyboard-review");
  const finalDir = path.join(reviewRoot, `round-${normalizedRound}`);
  const pendingDir = path.join(reviewRoot, `round-${normalizedRound}.in-progress`);
  for (const candidate of [finalDir, pendingDir]) {
    try {
      if (fs.lstatSync(candidate).isSymbolicLink()) throw new Error(`Refusing symlink in storyboard evidence path: ${candidate}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    if (!isPathInside(projectRoot, path.resolve(candidate))) throw new Error("Storyboard evidence path is outside the project.");
  }
  return { projectRoot, reviewRoot, finalDir, pendingDir, round: normalizedRound };
}

function readDirectoryEntries(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
}

function insideProject(projectRoot, target) {
  const relative = path.relative(projectRoot, target);
  if (!isPathInside(projectRoot, target)) throw new Error(`Visual source resolves outside the project: ${relative}`);
}

async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", chunk => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

// meta.json guarda las aprobaciones (`pnpm run status --approve …`), que se anotan DESPUÉS de revisar las capturas: aprobar no puede
// dejarlas obsoletas. El resto de meta.json (plantilla, marca, versión del kit) sí cuenta.
async function hashProjectFile(absolute, relative) {
  if (relative === "meta.json") {
    try {
      const { approvals, ...rest } = JSON.parse(fs.readFileSync(absolute, "utf8"));
      if (rest && typeof rest === "object") return crypto.createHash("sha256").update(JSON.stringify(rest)).digest("hex");
    } catch {
      // JSON ilegible: se cuenta tal cual.
    }
  }
  return sha256File(absolute);
}

async function collectInputDirectory(projectRoot, absoluteDirectory, relativeDirectory, output, visitedDirectories) {
  const realDirectory = fs.realpathSync.native(absoluteDirectory);
  insideProject(projectRoot, realDirectory);
  if (visitedDirectories.has(realDirectory)) return;
  visitedDirectories.add(realDirectory);
  for (const entry of readDirectoryEntries(absoluteDirectory)) {
    if (entry.name === ".DS_Store") continue;
    if (!relativeDirectory && (PROJECT_OUTPUTS.has(entry.name) || ATOMIC_TEMP_FILE.test(entry.name))) continue;
    const absolute = path.join(absoluteDirectory, entry.name);
    const relative = path.posix.join(relativeDirectory, entry.name);
    if (entry.isSymbolicLink()) {
      const real = fs.realpathSync.native(absolute);
      insideProject(projectRoot, real);
      const targetStat = fs.statSync(real);
      if (targetStat.isDirectory()) {
        await collectInputDirectory(projectRoot, real, relative, output, visitedDirectories);
      } else if (targetStat.isFile()) {
        output[relative] = await sha256File(real);
      }
    } else if (entry.isDirectory()) {
      await collectInputDirectory(projectRoot, absolute, relative, output, visitedDirectories);
    } else if (entry.isFile()) {
      output[relative] = await hashProjectFile(absolute, relative);
    }
  }
}

export async function hashStoryboardInputs(projectDir) {
  const projectRoot = fs.realpathSync.native(projectDir);
  const inputs = {};
  await collectInputDirectory(projectRoot, projectRoot, "", inputs, new Set());
  const studioRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  for (const relative of STUDIO_CAPTURE_INPUTS) {
    const absolute = path.join(studioRoot, relative);
    if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
      inputs[`@studio/${relative}`] = await sha256File(absolute);
    }
  }
  const ordered = Object.fromEntries(Object.entries(inputs).sort(([left], [right]) => left.localeCompare(right)));
  const digest = crypto.createHash("sha256").update(JSON.stringify(ordered)).digest("hex");
  return { inputs: ordered, digest };
}

// Qué entradas difieren entre dos huellas (para decir qué cambió durante una captura).
export function diffStoryboardInputs(before, after) {
  const keys = new Set([...Object.keys(before.inputs), ...Object.keys(after.inputs)]);
  return [...keys].filter(key => before.inputs[key] !== after.inputs[key]).sort();
}

// Una captura fallida no debe bloquear el reintento: su carpeta .in-progress se aparta (nunca se borra) a round-NN.failed-K.
export function setAsideIncompleteRound(projectDir, round) {
  const { pendingDir } = storyboardRoundPaths(projectDir, round);
  if (!fs.existsSync(pendingDir)) return null;
  for (let attempt = 1; ; attempt++) {
    const target = pendingDir.replace(/\.in-progress$/, `.failed-${attempt}`);
    if (fs.existsSync(target)) continue;
    fs.renameSync(pendingDir, target);
    return target;
  }
}

function safeEvidenceFile(roundDir, relativePath) {
  if (typeof relativePath !== "string" || !relativePath || path.isAbsolute(relativePath) || relativePath.includes("\\")) {
    throw new Error(`Invalid relative evidence path: ${relativePath}`);
  }
  const normalized = path.posix.normalize(relativePath);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) throw new Error(`Evidence path escapes its round: ${relativePath}`);
  const absolute = path.resolve(roundDir, normalized);
  if (!isPathInside(roundDir, absolute)) throw new Error(`Evidence path escapes its round: ${relativePath}`);
  let current = roundDir;
  for (const part of normalized.split("/")) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) break;
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Refusing symlink in storyboard evidence file: ${relativePath}`);
  }
  return absolute;
}

export async function writeEvidenceManifest(projectDir, round, {
  shots, coverage, requestedInstants = [], comparisons = [], directory = null, expectedSourceDigest = null,
}) {
  const { finalDir } = storyboardRoundPaths(projectDir, round);
  const evidenceDir = directory ? path.resolve(directory) : finalDir;
  if (!isPathInside(path.dirname(finalDir), evidenceDir)
    || ![finalDir, `${finalDir}.in-progress`].includes(evidenceDir)) {
    throw new Error("Storyboard evidence must be written to its round directory.");
  }
  const source = await hashStoryboardInputs(projectDir);
  if (expectedSourceDigest && source.digest !== expectedSourceDigest) {
    throw new Error("Storyboard inputs changed during capture; this round was not finalized.");
  }
  const evidence = [];
  const seen = new Set();
  for (const relativePath of ["hoja.jpg", "poses.json", ...shots.map(shot => shot.frame), ...comparisons.map(item => item.path)]) {
    if (!relativePath || seen.has(relativePath)) continue;
    seen.add(relativePath);
    const absolute = safeEvidenceFile(evidenceDir, relativePath);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw new Error(`Missing evidence file: ${relativePath}`);
    evidence.push({ path: relativePath, sha256: await sha256File(absolute) });
  }
  const manifest = {
    schemaVersion: 1,
    captureVersion: CAPTURE_VERSION,
    hyperframesVersion: HYPERFRAMES_VERSION,
    round: normalizeRound(round),
    coverage,
    sceneIds: [...new Set([
      ...shots.flatMap(shot => shot.sceneIds ?? [shot.scene]),
      ...requestedInstants.flatMap(item => item.sceneIds ?? []),
    ])],
    sourceDigest: source.digest,
    sourceInputs: source.inputs,
    shots: shots.map(shot => ({
      scene: shot.scene,
      ...(shot.sceneIds ? { sceneIds: shot.sceneIds } : {}),
      kind: shot.kind,
      ...(shot.samples ? { samples: shot.samples } : {}),
      seconds: shot.seconds,
      path: shot.frame,
    })),
    requestedInstants,
    evidenceFiles: evidence,
    comparisons,
  };
  fs.writeFileSync(path.join(evidenceDir, "evidence-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

export async function verifyRoundEvidence(projectDir, round) {
  try {
    const paths = storyboardRoundPaths(projectDir, round);
    if (!fs.existsSync(paths.finalDir) || !fs.statSync(paths.finalDir).isDirectory()) {
      return { status: "UNKNOWN", round: paths.round, reason: fs.existsSync(paths.pendingDir) ? "Capture is incomplete (.in-progress directory exists)." : "Round evidence is missing." };
    }
    const manifestPath = path.join(paths.finalDir, "evidence-manifest.json");
    const posesPath = path.join(paths.finalDir, "poses.json");
    if (!fs.existsSync(manifestPath) || !fs.existsSync(posesPath)) return { status: "UNKNOWN", round: paths.round, reason: "Round manifest or poses.json is missing." };
    if (fs.lstatSync(manifestPath).isSymbolicLink() || fs.lstatSync(posesPath).isSymbolicLink()) {
      return { status: "UNKNOWN", round: paths.round, reason: "Round manifest or poses.json is a symlink." };
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const poses = JSON.parse(fs.readFileSync(posesPath, "utf8"));
    if (manifest.schemaVersion !== 1 || manifest.round !== paths.round || !Array.isArray(manifest.evidenceFiles) || !Array.isArray(manifest.shots)) {
      return { status: "UNKNOWN", round: paths.round, reason: "Round manifest has an unsupported or incomplete shape." };
    }
    if (!Array.isArray(poses.shots) || poses.shots.length !== manifest.shots.length) {
      return { status: "UNKNOWN", round: paths.round, reason: "Manifest does not match poses.json." };
    }
    const evidencePaths = new Set(manifest.evidenceFiles.map(item => item.path));
    for (const [index, shot] of manifest.shots.entries()) {
      const pose = poses.shots[index];
      if (pose?.frame !== shot.path || pose?.kind !== shot.kind || Number(pose?.seconds) !== Number(shot.seconds)
        || String(pose?.scene) !== String(shot.scene) || !evidencePaths.has(shot.path)) {
        return { status: "UNKNOWN", round: paths.round, reason: `Shot evidence is missing or mismatched at row ${index + 1}.` };
      }
    }
    for (const item of manifest.evidenceFiles) {
      const absolute = safeEvidenceFile(paths.finalDir, item.path);
      if (!fs.existsSync(absolute) || !fs.lstatSync(absolute).isFile() || fs.lstatSync(absolute).isSymbolicLink()) {
        return { status: "UNKNOWN", round: paths.round, reason: `Evidence file is missing or unsafe: ${item.path}` };
      }
      if (await sha256File(absolute) !== item.sha256) return { status: "UNKNOWN", round: paths.round, reason: `Evidence file changed after capture: ${item.path}` };
    }
    for (const shot of manifest.shots) safeEvidenceFile(paths.finalDir, shot.path);
    const current = await hashStoryboardInputs(projectDir);
    if (current.digest !== manifest.sourceDigest) {
      return { status: "STALE", round: paths.round, coverage: manifest.coverage, reason: "Storyboard inputs changed after these frames were captured." };
    }
    if (manifest.captureVersion !== CAPTURE_VERSION || manifest.hyperframesVersion !== HYPERFRAMES_VERSION) {
      return { status: "STALE", round: paths.round, coverage: manifest.coverage, reason: "Pose capture implementation or HyperFrames version changed after these frames were captured." };
    }
    return { status: "FRESH", round: paths.round, coverage: manifest.coverage, sceneIds: manifest.sceneIds, shotCount: manifest.shots.length, evidenceFileCount: manifest.evidenceFiles.length };
  } catch (error) {
    return { status: "UNKNOWN", round: String(round), reason: error.message };
  }
}
