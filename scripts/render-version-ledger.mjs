import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

function fail(message) {
  console.error(`No se puede actualizar renders/VERSIONES.txt: ${message}`);
  process.exitCode = 1;
}

function statIfPresent(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function validateLedger(path, projectRoot) {
  const root = realpathSync(projectRoot);
  const renders = resolve(root, "renders");
  const rendersStat = lstatSync(renders);
  if (!rendersStat.isDirectory() || rendersStat.isSymbolicLink()) throw new Error("renders/ debe ser un directorio local del proyecto.");
  const canonicalRenders = realpathSync(renders);
  if (canonicalRenders !== renders) throw new Error("renders/ no puede salir de la ruta canónica del proyecto.");

  if (basename(path) !== "VERSIONES.txt" || realpathSync(dirname(resolve(path))) !== canonicalRenders) {
    throw new Error("la ruta del registro no es la permitida.");
  }
  const ledger = join(canonicalRenders, "VERSIONES.txt");
  const stat = statIfPresent(ledger);
  if (stat && (stat.isSymbolicLink() || !stat.isFile())) throw new Error("VERSIONES.txt debe ser un archivo normal, no un symlink.");
  if (stat && stat.nlink !== 1) throw new Error("VERSIONES.txt no puede tener hardlinks.");
  return { ledger, canonicalRenders, stat };
}

export function checkLedger(path, projectRoot) {
  validateLedger(path, projectRoot);
}

function readCurrentLedger(ledger, expectedStat) {
  if (!expectedStat) return "";
  const noFollow = constants.O_NOFOLLOW ?? 0;
  const fd = openSync(ledger, constants.O_RDONLY | noFollow);
  try {
    const opened = fstatSync(fd);
    const current = lstatSync(ledger);
    if (!opened.isFile() || opened.nlink !== 1 || current.isSymbolicLink()
      || opened.dev !== current.dev || opened.ino !== current.ino
      || opened.dev !== expectedStat.dev || opened.ino !== expectedStat.ino) {
      throw new Error("VERSIONES.txt cambió durante la actualización.");
    }
    return readFileSync(fd, "utf8");
  } finally {
    closeSync(fd);
  }
}

export function appendLedger(path, projectRoot, entry) {
  const { ledger, canonicalRenders, stat } = validateLedger(path, projectRoot);
  const lock = join(canonicalRenders, ".VERSIONES.txt.lock");
  let lockFd;
  try {
    lockFd = openSync(lock, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") throw new Error("otro render está actualizando VERSIONES.txt.");
    throw error;
  }

  let temp;
  let tempFd;
  try {
    const current = readCurrentLedger(ledger, stat);
    const latest = validateLedger(ledger, projectRoot);
    if ((stat?.ino ?? null) !== (latest.stat?.ino ?? null) || (stat?.dev ?? null) !== (latest.stat?.dev ?? null)) {
      throw new Error("VERSIONES.txt cambió durante la actualización.");
    }
    temp = join(canonicalRenders, `.VERSIONES.txt.${process.pid}.${randomBytes(8).toString("hex")}.tmp`);
    tempFd = openSync(temp, "wx", stat ? stat.mode & 0o777 : 0o600);
    writeFileSync(tempFd, `${current}${entry}\n`, "utf8");
    closeSync(tempFd);
    tempFd = undefined;
    renameSync(temp, ledger);
    temp = undefined;
  } finally {
    if (tempFd !== undefined) closeSync(tempFd);
    if (temp) unlinkSync(temp);
    closeSync(lockFd);
    unlinkSync(lock);
  }
}

function main() {
  const [mode, ledgerPath, projectRoot, ...entryParts] = process.argv.slice(2);
  try {
    if (mode === "--check" && ledgerPath && projectRoot && entryParts.length === 0) checkLedger(ledgerPath, projectRoot);
    else if (mode === "--append" && ledgerPath && projectRoot && entryParts.length === 1) appendLedger(ledgerPath, projectRoot, entryParts[0]);
    else throw new Error("uso: --check <ledger> <proyecto> | --append <ledger> <proyecto> <entrada>");
  } catch (error) {
    fail(error.message);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
