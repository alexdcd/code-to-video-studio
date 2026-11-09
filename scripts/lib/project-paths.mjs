import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_PATH = fileURLToPath(import.meta.url);
const DEFAULT_STUDIO_ROOT = path.resolve(path.dirname(MODULE_PATH), "../..");

export function resolveProjectsRoot(studioRoot = DEFAULT_STUDIO_ROOT, env = process.env) {
  const configured = env.CTV_PROJECTS_ROOT;
  if (configured == null || configured === "") return validateProjectsRoot(studioRoot, path.join(studioRoot, "proyectos"));
  if (!path.isAbsolute(configured)) {
    throw new Error("CTV_PROJECTS_ROOT must be an absolute path.");
  }
  return validateProjectsRoot(studioRoot, configured);
}

export function validateProjectsRoot(studioRoot, candidate) {
  if (!path.isAbsolute(candidate)) {
    throw new Error("CTV_PROJECTS_ROOT must be an absolute path.");
  }

  const studio = fs.realpathSync.native(studioRoot);
  const configured = path.resolve(candidate);
  const canonicalConfigured = realpathWithMissingTail(configured);
  const repository = findRepositoryRoot(studio);
  const ignoredProjects = realpathWithMissingTail(path.join(repository, "proyectos"));
  if (isPathInside(repository, canonicalConfigured) && !isPathInside(ignoredProjects, canonicalConfigured)) {
    throw new Error(`CTV_PROJECTS_ROOT must be outside versionable Studio folders; only ${ignoredProjects} is allowed inside the repository.`);
  }
  try {
    if (fs.existsSync(configured) && !fs.statSync(configured).isDirectory()) {
      throw new Error("CTV_PROJECTS_ROOT must name a directory.");
    }
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
  }
  return configured;
}

function findRepositoryRoot(studioRoot) {
  let current = studioRoot;
  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return studioRoot;
    current = parent;
  }
}

function realpathWithMissingTail(candidate) {
  let current = path.resolve(candidate);
  const missing = [];
  while (true) {
    try {
      return path.resolve(fs.realpathSync.native(current), ...missing);
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      missing.unshift(path.basename(current));
      current = parent;
    }
  }
}

function isPathInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export function resolveProjectPath(value, options = {}) {
  const studioRoot = options.studioRoot ?? DEFAULT_STUDIO_ROOT;
  const projectsRoot = validateProjectsRoot(studioRoot, options.projectsRoot ?? resolveProjectsRoot(studioRoot));
  const cwd = options.cwd ?? process.cwd();
  const requireIndex = options.requireIndex ?? true;
  const input = String(value ?? "");
  if (!input) throw new Error("Project path is required.");

  let candidate;
  if (input === "proyectos") {
    candidate = projectsRoot;
  } else if (input.startsWith("proyectos/")) {
    candidate = path.resolve(projectsRoot, input.slice("proyectos/".length));
  } else if (path.isAbsolute(input)) {
    candidate = path.resolve(input);
  } else if (input === "." || input.startsWith("./") || input.startsWith("../")) {
    candidate = path.resolve(cwd, input);
  } else {
    candidate = path.resolve(projectsRoot, input);
  }

  let canonicalRoot;
  let canonicalCandidate;
  try {
    canonicalRoot = fs.realpathSync(projectsRoot);
    canonicalCandidate = fs.realpathSync(candidate);
  } catch {
    throw new Error(`Project directory does not exist: ${candidate}`);
  }

  const relative = path.relative(canonicalRoot, canonicalCandidate);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Project must be inside CTV_PROJECTS_ROOT (${canonicalRoot}).`);
  }
  if (!fs.statSync(canonicalCandidate).isDirectory()) {
    throw new Error(`Project path is not a directory: ${canonicalCandidate}`);
  }
  if (requireIndex && !fs.existsSync(path.join(canonicalCandidate, "index.html"))) {
    throw new Error(`Project has no index.html: ${canonicalCandidate}`);
  }
  return canonicalCandidate;
}

export function resolveProjectFilePath(value, options = {}) {
  const studioRoot = options.studioRoot ?? DEFAULT_STUDIO_ROOT;
  const projectsRoot = validateProjectsRoot(studioRoot, options.projectsRoot ?? resolveProjectsRoot(studioRoot));
  const cwd = options.cwd ?? process.cwd();
  const input = String(value ?? "");
  if (!input) throw new Error("Project file path is required.");

  let candidate;
  if (input.startsWith("proyectos/")) {
    candidate = path.resolve(projectsRoot, input.slice("proyectos/".length));
  } else if (path.isAbsolute(input)) {
    candidate = path.resolve(input);
  } else {
    candidate = path.resolve(cwd, input);
  }

  let canonicalRoot;
  let canonicalCandidate;
  try {
    canonicalRoot = fs.realpathSync(projectsRoot);
    canonicalCandidate = fs.realpathSync(candidate);
  } catch {
    throw new Error(`Project file does not exist: ${candidate}`);
  }
  const relative = path.relative(canonicalRoot, canonicalCandidate);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Project file must be inside CTV_PROJECTS_ROOT (${canonicalRoot}).`);
  }
  return canonicalCandidate;
}

/** New projects use SCRIPT.md; recognize a default legacy GUION.md without hiding user edits. */
export function resolveProjectScriptPath(projectRoot) {
  const script = path.join(projectRoot, "SCRIPT.md");
  const legacy = path.join(projectRoot, "GUION.md");
  const hasScript = fs.existsSync(script);
  const hasLegacy = fs.existsSync(legacy);
  if (!hasScript) return hasLegacy ? legacy : script;
  if (!hasLegacy) return script;

  const scriptText = normalizeLineEndings(fs.readFileSync(script, "utf8"));
  const legacyText = normalizeLineEndings(fs.readFileSync(legacy, "utf8"));
  if (scriptText === legacyText) return script;

  const commonTemplate = path.join(DEFAULT_STUDIO_ROOT, "templates", "_common", "SCRIPT.md");
  if (fs.existsSync(commonTemplate)) {
    const projectName = path.basename(path.resolve(projectRoot));
    const commonText = normalizeLineEndings(fs.readFileSync(commonTemplate, "utf8")
      .replaceAll("{{NOMBRE}}", projectName)
      .replaceAll("{{NAME}}", projectName));
    if (legacyText === commonText) return script;
    if (scriptText === commonText) return legacy;
  }

  throw new Error("Both SCRIPT.md and GUION.md exist and differ. Reconcile the edits and keep the canonical script in SCRIPT.md.");
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, "\n");
}

/** Keep per-project pnpm commands and instruction links usable even when CTV_PROJECTS_ROOT is external. */
export function retargetStudioReferences(value, destination, studioRoot = DEFAULT_STUDIO_ROOT, { shell = false } = {}) {
  const relative = path.relative(destination, studioRoot).split(path.sep).join("/");
  if (path.isAbsolute(relative)) {
    throw new Error("El proyecto y Studio deben estar en una misma unidad para scripts locales.");
  }
  if (shell) {
    // Only script-path arguments are shell tokens; Markdown references stay literal.
    const quote = token => /^[A-Za-z0-9_./-]+$/.test(token) ? token : "'" + token.replaceAll("'", "'\\''") + "'";
    return value.replace(/(["'])((?:\.\.\/)+(?:scripts|herramientas)\/[^"']+)\1|((?:\.\.\/)+(?:scripts|herramientas)\/[^\s"';&|<>]+)/g,
      (_match, _quote, quoted, bare) => quote(retargetStudioReferences(quoted ?? bare, destination, studioRoot)));
  }
  return value.replace(/(?:\.\.\/)+(scripts\/|herramientas\/|proyectos\/AGENTS\.md|AGENTS\.md|kit\/|skills\/)/g, `${relative}/$1`);
}

/**
 * An external CTV_PROJECTS_ROOT does not sit under the Studio, so agents opened in one of its projects would not inherit
 * proyectos/AGENTS.md. A link keeps one source: Claude Code loads it as a parent AGENTS.md (Codex too inside a git root).
 */
export function linkProductionInstructions(projectsRoot, studioRoot = DEFAULT_STUDIO_ROOT) {
  const source = path.join(studioRoot, "proyectos", "AGENTS.md");
  const link = path.join(projectsRoot, "AGENTS.md");
  if (!fs.existsSync(source)) return "missing";
  if (fs.realpathSync(projectsRoot) === fs.realpathSync(path.dirname(source))) return "studio";
  try {
    const current = fs.lstatSync(link);
    if (current.isSymbolicLink() && fs.realpathSync(link) === fs.realpathSync(source)) return "linked";
    return "kept";
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  fs.symlinkSync(source, link);
  return "created";
}

function retargetProjectFiles(projectRoot, studioRoot = DEFAULT_STUDIO_ROOT) {
  const agentsFile = path.join(projectRoot, "AGENTS.md");
  if (fs.existsSync(agentsFile)) {
    fs.writeFileSync(agentsFile, retargetStudioReferences(fs.readFileSync(agentsFile, "utf8"), projectRoot, studioRoot));
  }
  const packageFile = path.join(projectRoot, "package.json");
  if (fs.existsSync(packageFile)) {
    const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8"));
    for (const [command, script] of Object.entries(pkg.scripts ?? {})) {
      if (typeof script === "string") pkg.scripts[command] = retargetStudioReferences(script, projectRoot, studioRoot, { shell: true });
    }
    fs.writeFileSync(packageFile, `${JSON.stringify(pkg, null, 2)}\n`);
  }
}

function runCli(args) {
  const [operation, value, ...extra] = args;
  if (operation === "retarget" && value && extra.length === 0) {
    const projectRoot = resolveProjectPath(value, { requireIndex: false });
    retargetProjectFiles(projectRoot);
    if (linkProductionInstructions(path.dirname(projectRoot)) === "kept") {
      console.error(`Aviso: ${path.join(path.dirname(projectRoot), "AGENTS.md")} no enlaza con proyectos/AGENTS.md del Studio; no se toca.`);
    }
    return;
  }
  if (operation === "root" && value === undefined && extra.length === 0) {
    process.stdout.write(`${resolveProjectsRoot()}\n`);
    return;
  }
  if (operation === "project" && value && extra.length === 0) {
    process.stdout.write(`${resolveProjectPath(value)}\n`);
    return;
  }
  if (operation === "file" && value && extra.length === 0) {
    process.stdout.write(`${resolveProjectFilePath(value)}\n`);
    return;
  }
  throw new Error("Usage: project-paths.mjs root | project <name-or-path> | file <path> | retarget <name-or-path>");
}

if (process.argv[1] && path.resolve(process.argv[1]) === MODULE_PATH) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
