#!/usr/bin/env node
/** Create an independent project variant without generated output, secrets, caches, or model weights. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STUDIO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ID_RE = /^(?=.{1,48}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LANGUAGE_RE = /^[A-Za-z]{2}(?:-[A-Za-z]{2})?$/;
const OMIT_TOP_LEVEL = new Set([
  "renders", "snapshots", "variants", "variantes", "node_modules", ".hyperframes", ".git",
  ".venv", "venv", ".cache", ".analysis", "cache", "dist", "build", "outputs", "weights",
  "models", "checkpoints", "stems", "secrets", "credentials",
]);
const OMIT_DIRECTORY = new Set([
  "node_modules", ".git", ".hyperframes", ".venv", "venv", ".cache", ".analysis", "cache",
  "__pycache__", "weights", "models", "checkpoints", "secrets", "credentials",
]);
const OMIT_FILE = /^(?:\.DS_Store|\.env(?:\..*)?|\.npmrc|\.pypirc|.*(?:secret|credential|token|api[-_.]?key|private[-_.]?key).*(?:\..*)?|.*\.(?:key|pem|p12|pfx|safetensors|ckpt|pth|pt|gguf|onnx|tflite|pyc))$/i;

function usage() {
  return "Usage: pnpm run variant <project> <variant-id> [--language es-ES|en-US|en-GB]";
}

export function parseArgs(args) {
  const [source, id, ...rest] = args.filter((arg) => arg !== "--");
  if (!source || !ID_RE.test(id ?? "")) throw new Error(`${usage()} (id: lowercase letters, numbers and single hyphens, max 48)`);
  let language = null;
  for (let index = 0; index < rest.length; index += 1) {
    if (!["--language", "--idioma"].includes(rest[index]) || language !== null || !rest[index + 1]) throw new Error(usage());
    language = rest[++index];
    if (!LANGUAGE_RE.test(language)) throw new Error(`Unsupported language: ${language}`);
  }
  return { source, id, language };
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function normalDirectory(candidate) {
  const stat = fs.lstatSync(candidate);
  return stat.isDirectory() && !stat.isSymbolicLink();
}

function resolveSource(value, studioRoot, projectsRoot) {
  const input = String(value ?? "");
  if (!input) throw new Error("Project path is required.");
  const projects = fs.realpathSync(projectsRoot);
  let candidate = path.isAbsolute(input) ? path.resolve(input)
    : input.startsWith(`proyectos${path.sep}`) || input.startsWith("proyectos/")
      ? path.resolve(projects, input.slice("proyectos/".length))
      : path.resolve(projects, input);
  if (!isInside(projects, candidate) || path.dirname(candidate) !== projects) {
    throw new Error("A source project must be a direct child of proyectos/.");
  }
  candidate = fs.realpathSync(candidate);
  if (!isInside(projects, candidate) || !normalDirectory(candidate)) {
    throw new Error("The source must be a real project directory inside proyectos/.");
  }
  if (!fs.existsSync(path.join(candidate, "index.html"))) throw new Error("The source project needs index.html.");
  return candidate;
}

function shouldOmit(parts, name) {
  if (parts.length === 0 && OMIT_TOP_LEVEL.has(name)) return true;
  if (OMIT_DIRECTORY.has(name) || /^\..*\.analysis$/.test(name) || OMIT_FILE.test(name)) return true;
  return false;
}

function copyTree(source, destination, parts = []) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    // Filter excluded names before lstat so an excluded symlink is never followed or inspected.
    if (shouldOmit(parts, entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    const stat = fs.lstatSync(from);
    if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in projects: ${from}`);
    if (stat.isDirectory()) {
      fs.mkdirSync(to, { mode: stat.mode & 0o777 });
      copyTree(from, to, [...parts, entry.name]);
    } else if (stat.isFile()) {
      if (stat.nlink !== 1) throw new Error(`Hard linked files are not allowed in projects: ${from}`);
      fs.copyFileSync(from, to);
    } else {
      throw new Error(`Unsupported project file type: ${from}`);
    }
  }
}

function latestRender(projectDir) {
  const rendersDir = path.join(projectDir, "renders");
  const ledger = path.join(rendersDir, "VERSIONES.txt");
  try {
    if (!normalDirectory(rendersDir)) return null;
    const stat = fs.lstatSync(ledger);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) return null;
    const projectName = path.basename(projectDir);
    const entries = [...fs.readFileSync(ledger, "utf8").matchAll(/^v(\d+)\s*[·|]/gm)];
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const version = `v${entries[index][1].padStart(2, "0")}`;
      const candidates = [`${projectName}-${version}.mp4`, `${projectName}-${version}-redes.mp4`];
      if (candidates.some((name) => {
        try {
          const file = fs.lstatSync(path.join(rendersDir, name));
          return file.isFile() && !file.isSymbolicLink() && file.nlink === 1;
        } catch (error) {
          if (error.code === "ENOENT") return false;
          throw error;
        }
      })) return version;
    }
  } catch (error) {
    if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
  }
  return null;
}

function setNarrationLanguage(file, language) {
  if (!language) return;
  const content = fs.readFileSync(file, "utf8");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    fs.writeFileSync(file, `---\nnarration_language: ${language}\n---\n\n${content}`);
    return;
  }
  const fields = /^narration_language\s*:/m.test(match[1])
    ? match[1].replace(/^narration_language\s*:.*$/m, `narration_language: ${language}`)
    : `${match[1].trimEnd()}\nnarration_language: ${language}`;
  fs.writeFileSync(file, `---\n${fields}\n---\n${content.slice(match[0].length)}`);
}

export function createVariant({ source, id, language = null, studioRoot = STUDIO_ROOT } = {}) {
  const projectsRoot = path.join(studioRoot, "proyectos");
  if (!ID_RE.test(id ?? "")) throw new Error("Variant id must use lowercase letters, numbers and single hyphens.");
  if (language !== null && !LANGUAGE_RE.test(language)) throw new Error("Variant language must be a language code such as en-US.");
  const sourceDir = resolveSource(source, studioRoot, projectsRoot);
  const sourceName = path.basename(sourceDir);
  const sourceMetaPath = path.join(sourceDir, "meta.json");
  const sourceMeta = fs.existsSync(sourceMetaPath) ? JSON.parse(fs.readFileSync(sourceMetaPath, "utf8")) : {};
  const originProject = sourceMeta.origin_project ?? sourceMeta.parent_project ?? sourceName;
  if (typeof originProject !== "string" || !ID_RE.test(originProject)) throw new Error("Source origin metadata is invalid.");
  const originDir = path.join(projectsRoot, originProject);
  if (!normalDirectory(originDir)) throw new Error("The original project named in metadata is missing.");
  const name = `${originProject}--${id}`;
  const target = path.join(projectsRoot, name);
  try {
    fs.mkdirSync(target, { mode: 0o755 });
  } catch (error) {
    if (error.code === "EEXIST") throw new Error(`Variant already exists: proyectos/${name}. Nothing was overwritten.`);
    throw error;
  }

  try {
    copyTree(sourceDir, target);
    setNarrationLanguage(path.join(target, "BRIEF.md"), language);
    const metaPath = path.join(target, "meta.json");
    const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : {};
    const sourceCreated = sourceMeta.created ?? sourceMeta.creado ?? null;
    const sourceRender = latestRender(sourceDir);
    delete meta.approvals;
    delete meta.source_approved_render;
    meta.id = name;
    meta.name = name;
    meta.origin_project = originProject;
    meta.origin_created = sourceMeta.origin_created ?? sourceCreated;
    meta.origin_render = sourceMeta.origin_render ?? sourceRender;
    meta.source_project = sourceName;
    meta.source_created = sourceCreated;
    meta.source_render = sourceRender;
    meta.parent_project = originProject;
    meta.variant = id;
    meta.variant_of = sourceName;
    meta.created = new Date().toISOString().slice(0, 10);
    meta.variant_created = new Date().toISOString();
    fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
    if (!fs.existsSync(path.join(target, "index.html"))) throw new Error("The source project has no index.html.");
    return target;
  } catch (error) {
    // Only remove the new target; the source and any prior project are never changed.
    fs.rmSync(target, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const target = createVariant(parseArgs(process.argv.slice(2)));
    const project = path.relative(STUDIO_ROOT, target).split(path.sep).join("/");
    console.log(`Created independent variant: ${project}`);
    console.log(`Review and adapt its BRIEF.md, SCRIPT.md and STORYBOARD.md, then run pnpm run check ${project}.`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}
