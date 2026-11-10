import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { renderProject } from "./lib/render-pipeline.mjs";
import { resolveProjectPath, resolveProjectsRoot } from "./lib/project-paths.mjs";
import { readSceneTimes, checkTimes } from "./lib/scene-times.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hyperframesEntry = path.join(ROOT, "node_modules", "hyperframes", "bin", "hyperframes.mjs");

function check(dir, rest) {
  const has = flag => rest.some(arg => arg === flag || arg.startsWith(`${flag}=`));
  const extra = [];
  if (!has("--timeout")) extra.push("--timeout", "90000");
  if (!has("--at") && !has("--samples")) {
    try {
      const times = checkTimes(readSceneTimes(dir).scenes);
      if (times.length) extra.push("--at", times.join(","));
    } catch { /* Keep HyperFrames' default sampling when timeline inspection fails. */ }
  }
  if (!has("--frame-check")) extra.push("--frame-check");
  const json = rest.includes("--json");
  const renders = path.join(dir, "renders");
  fs.mkdirSync(renders, { recursive: true });
  if (fs.lstatSync(renders).isSymbolicLink()) throw new Error("renders must not be a symlink.");
  const temporary = fs.mkdtempSync(path.join(renders, ".check-"));
  const reportPath = path.join(temporary, "check.json");
  try {
    const fd = fs.openSync(reportPath, "wx");
    let result;
    try {
      result = spawnSync(process.execPath, [hyperframesEntry, "check", ...extra, ...rest, ...(json ? [] : ["--json"])], {
        cwd: dir, stdio: ["inherit", fd, "inherit"], shell: false,
      });
    } finally { fs.closeSync(fd); }
    const output = fs.readFileSync(reportPath, "utf8");
    if (json) process.stdout.write(output);
    let report;
    try { report = JSON.parse(output); } catch { /* Preserve the last valid report. */ }
    if (report !== undefined) {
      fs.renameSync(reportPath, path.join(renders, "check.json"));
      if (!json) {
        console.log(`◆  Checking ${path.basename(dir)}`);
        const python = process.env.PYTHON?.trim() || (process.platform === "win32" ? "python" : "python3");
        const summary = spawnSync(python, ["-X", "utf8", path.join(ROOT, "scripts/lib/check_summary.py"), path.join(renders, "check.json")], { stdio: "inherit", shell: false });
        if (summary.error) console.error(summary.error.message);
        if (summary.status !== 0) return result.status || 1;
      }
    } else if (!json) process.stdout.write(output);
    if (result.error) console.error(result.error.message);
    return result.status ?? 1;
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}

try {
  const [action, ...args] = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  const [project, ...rest] = args;
  if (!action || !project) {
    let available = "";
    try {
      const root = resolveProjectsRoot(ROOT);
      const names = fs.readdirSync(root).filter(name => fs.existsSync(path.join(root, name, "index.html"))).sort();
      if (names.length) available = `\nProjects: ${names.join(" ")}`;
    } catch { /* The usage line is enough when the projects root cannot be read. */ }
    throw new Error(`Usage: pnpm run <check|render|dev> <project> [...args]${available}`);
  }
  const dir = resolveProjectPath(project, { studioRoot: ROOT });
  if (!fs.existsSync(hyperframesEntry)) throw new Error("HyperFrames not installed. Run pnpm install.");
  if (action === "check") process.exitCode = check(dir, rest);
  else if (action === "render") {
    const note = rest.length && !rest[0].startsWith("-") ? rest.shift() : "";
    process.exitCode = renderProject({ projectDir: dir, hyperframesBin: [process.execPath, hyperframesEntry], hyperframesArgs: rest, note }).status;
  } else {
    const result = spawnSync(process.execPath, [hyperframesEntry, action === "dev" ? "preview" : action, ...rest], { cwd: dir, stdio: "inherit", shell: false });
    if (result.error) console.error(result.error.message);
    process.exitCode = result.status ?? 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
