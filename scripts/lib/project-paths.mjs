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

function runCli(args) {
  const [operation, value, ...extra] = args;
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
  throw new Error("Usage: project-paths.mjs root | project <name-or-path> | file <path>");
}

if (process.argv[1] && path.resolve(process.argv[1]) === MODULE_PATH) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
