#!/usr/bin/env node
/** Create an isolated sibling edition of a local video project, using CoW where available. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProjectPath, resolveProjectsRoot } from "./lib/project-paths.mjs";

const STUDIO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANGUAGE_RE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const VARIANT_RE = /^(?=.{1,48}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OMIT_TOP_LEVEL = new Set([
  "variants", "renders", "snapshots", "node_modules", ".hyperframes",
  ".git", ".venv", "venv", ".conda", ".aws", ".ssh", ".azure", "models", "recursos", "stems",
]);
const OMIT_DIRECTORY = new Set([
  "node_modules", ".git", ".hyperframes", ".venv", "venv", ".conda", ".aws", ".ssh", ".azure", "models", ".cache", "renders", "snapshots",
  "__pycache__", ".analysis", ".tmp", "weights", "checkpoints", "runs",
]);
const OMIT_FILE = /^(?:\.DS_Store|\.env(?:\..*)?|\.npmrc|\.pypirc|\.netrc|\.git-credentials|(?:id_(?:rsa|ed25519|ecdsa)|authorized_keys|known_hosts)|.*(?:credentials?|secrets?|api[-_.]?keys?|private[-_.]?keys?|access[-_.]?tokens?|cookies?).*\.(?:json|ya?ml|txt)|.*\.analysis\.json|.*\.proxy\.mp4|.*\.(?:pem|key|p12|pfx|jks|safetensors|gguf|onnx|tflite|engine|ckpt|pth|pt|pyc))$/i;

function usage() {
  return "Usage: pnpm run variant <source-project> <id> [--language BCP-47]";
}

export function parseArgs(args) {
  // pnpm 11 can forward "--" to package scripts; accept both common CLI forms.
  const [source, id, ...rest] = args.filter(arg => arg !== "--");
  if (!source || !VARIANT_RE.test(id ?? "")) {
    throw new Error(usage() + " (id: lowercase letters, numbers and single hyphens; maximum 48 characters)");
  }
  let language = null;
  for (let i = 0; i < rest.length; i++) {
    if ((rest[i] !== "--idioma" && rest[i] !== "--language") || language !== null || !rest[i + 1]) {
      throw new Error(usage());
    }
    language = rest[++i];
    if (!LANGUAGE_RE.test(language)) throw new Error(`Unsupported language tag: ${language}`);
  }
  return { source, id, language };
}

function isNormalDirectory(candidate) {
  const stat = fs.lstatSync(candidate);
  return stat.isDirectory() && !stat.isSymbolicLink();
}

function shouldOmit(parts, entry) {
  const name = entry.name;
  if (parts.length === 0 && OMIT_TOP_LEVEL.has(name)) return true;
  if (OMIT_DIRECTORY.has(name) || /^\..*\.analysis$/.test(name)) return true;
  if (OMIT_FILE.test(name)) return true;
  return false;
}

function copyTree(source, target, parts = []) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    // Filter names BEFORE lstat: an excluded renders/ symlink is not an input.
    if (shouldOmit(parts, entry)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    const stat = fs.lstatSync(from);
    if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not allowed inside a project: ${from}`);
    if (stat.isDirectory()) {
      fs.mkdirSync(to, { mode: stat.mode & 0o777 });
      copyTree(from, to, [...parts, entry.name]);
    } else if (stat.isFile()) {
      if (stat.nlink !== 1) throw new Error(`Hard-linked files are not allowed inside a project: ${from}`);
      // Use a copy-on-write clone where supported, then fall back to a normal copy.
      try {
        fs.copyFileSync(from, to, fs.constants.COPYFILE_FICLONE);
      } catch (error) {
        if (!["ENOTSUP", "EOPNOTSUPP", "ENOSYS", "EINVAL", "EXDEV"].includes(error.code)) throw error;
        fs.copyFileSync(from, to);
      }
    } else {
      throw new Error(`Unsupported file type: ${from}`);
    }
  }
}

function setNarrationLanguage(file, language) {
  if (!language || !fs.existsSync(file)) return;
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

/** Keep per-project pnpm commands usable even when CTV_PROJECTS_ROOT is external. */
function retargetStudioReferences(value, destination, studioRoot) {
  const relative = path.relative(destination, studioRoot).split(path.sep).join("/");
  if (path.isAbsolute(relative)) {
    throw new Error("The project and Studio must be on the same volume for local scripts.");
  }
  return value.replace(/(?:\.\.\/)+(scripts\/|tools\/|templates\/|AGENTS\.md|kit\/|skills\/)/g, `${relative}/$1`);
}

function sourceRender(source) {
  // Provenance only; the source tree may have changed since this MP4 was rendered.
  const renders = path.join(source, "renders");
  if (!fs.existsSync(renders)) return null;
  if (!isNormalDirectory(renders)) return null;
  const ledger = path.join(renders, "VERSIONES.txt");
  if (!fs.existsSync(ledger)) return null;
  const stat = fs.lstatSync(ledger);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) return null;
  const text = fs.readFileSync(ledger, "utf8");
  const project = path.basename(source);
  const matches = [...text.matchAll(/^v(\d+)\s*·/gm)];
  for (let i = matches.length - 1; i >= 0; i--) {
    const version = `v${matches[i][1]}`;
    const prefix = path.join(source, "renders", `${project}-${version}`);
    if ([`${prefix}.mp4`, `${prefix}-redes.mp4`].some(file => {
      try {
        const st = fs.lstatSync(file);
        return st.isFile() && !st.isSymbolicLink() && st.nlink === 1;
      } catch (error) {
        if (error.code === "ENOENT") return false;
        throw error;
      }
    })) return version;
  }
  return null;
}

/** Resolve lineage by authenticated sibling naming AND local metadata, never by string splitting alone. */
export function variantOwner(projectRoot, projectsRoot) {
  const canonicalRoot = fs.realpathSync(projectsRoot);
  const canonicalProject = fs.realpathSync(projectRoot);
  const parts = path.relative(canonicalRoot, canonicalProject).split(path.sep);
  if (parts.length !== 1 || !parts[0] || parts[0] === "_archive") {
    throw new Error("The source must be an active project directly inside the projects root.");
  }
  const metaFile = path.join(canonicalProject, "meta.json");
  if (fs.existsSync(metaFile)) {
    const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
    if (meta.parent_project !== undefined || meta.variant !== undefined) {
      if (typeof meta.parent_project !== "string" || typeof meta.variant !== "string"
        || !/^[a-z0-9][a-z0-9-]*$/.test(meta.parent_project) || !VARIANT_RE.test(meta.variant)
        || parts[0] !== `${meta.parent_project}--${meta.variant}`) {
        throw new Error("Variant lineage in meta.json does not match its directory.");
      }
      const owner = path.join(canonicalRoot, meta.parent_project);
      if (!fs.existsSync(path.join(owner, "index.html")) || !isNormalDirectory(owner)) {
        throw new Error("The parent project is no longer valid.");
      }
      return owner;
    }
  }
  return canonicalProject;
}

export function createVariant({ source, id, language = null, studioRoot = STUDIO_ROOT, projectsRoot } = {}) {
  if (!VARIANT_RE.test(id ?? "")) throw new Error("Invalid variant identifier.");
  if (language !== null && !LANGUAGE_RE.test(language)) throw new Error("Invalid variant language.");
  const root = projectsRoot ?? resolveProjectsRoot(studioRoot);
  const resolvedSource = resolveProjectPath(source, { studioRoot, projectsRoot: root });
  const resolvedRoot = fs.realpathSync(root);
  if (!isNormalDirectory(resolvedSource)) throw new Error("The source project must be a regular directory.");
  const owner = variantOwner(resolvedSource, resolvedRoot);
  const name = `${path.basename(owner)}--${id}`;
  const target = path.join(resolvedRoot, name);
  // 'wx' semantics for directories: never delete or overwrite a pre-existing sibling.
  try {
    fs.mkdirSync(target, { mode: 0o755 });
  } catch (error) {
    if (error.code === "EEXIST") throw new Error(`Variant already exists: ${target}. It will not be overwritten.`);
    throw error;
  }
  try {
    copyTree(resolvedSource, target);
    setNarrationLanguage(path.join(target, "BRIEF.md"), language);
    const packageFile = path.join(target, "package.json");
    if (fs.existsSync(packageFile)) {
      const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8"));
      pkg.name = name;
      if (pkg.scripts && typeof pkg.scripts === "object") {
        for (const [command, value] of Object.entries(pkg.scripts)) {
          if (typeof value === "string") {
            pkg.scripts[command] = retargetStudioReferences(value, target, studioRoot);
          }
        }
      }
      fs.writeFileSync(packageFile, `${JSON.stringify(pkg, null, 2)}\n`);
    }
    const agentsFile = path.join(target, "AGENTS.md");
    if (fs.existsSync(agentsFile)) {
      const instructions = fs.readFileSync(agentsFile, "utf8");
      const named = instructions.replace(/^# Project[^\r\n]*/m, `# Project ${name}`);
      fs.writeFileSync(agentsFile, retargetStudioReferences(named, target, studioRoot));
    }
    const metaFile = path.join(target, "meta.json");
    const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, "utf8")) : {};
    delete meta.approvals; // Past approvals do not certify a derivative.
    delete meta.source_approved_render; // Do not infer publication/approval from the latest render.
    meta.id = name;
    meta.name = name;
    const fromVariant = resolvedSource !== owner;
    meta.source_created = meta.created ?? meta.creado ?? null;
    meta.source_render = sourceRender(resolvedSource);
    // The original project's provenance survives derivatives of derivatives.
    meta.origin_created = fromVariant ? meta.origin_created ?? null : meta.source_created;
    meta.origin_render = fromVariant ? meta.origin_render ?? null : meta.source_render;
    meta.created = new Date().toISOString().slice(0, 10);
    meta.variant_created = new Date().toISOString();
    meta.parent_project = path.basename(owner);
    meta.variant = id;
    meta.source_project = path.relative(resolvedRoot, resolvedSource).split(path.sep).join("/");
    fs.writeFileSync(metaFile, `${JSON.stringify(meta, null, 2)}\n`);
    if (!fs.existsSync(path.join(target, "index.html"))) throw new Error("The source project has no index.html.");
    return target;
  } catch (error) {
    // Remove ONLY the fresh sibling; never the source, owner or another variant.
    fs.rmSync(target, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const target = createVariant(parseArgs(process.argv.slice(2)));
    const root = resolveProjectsRoot(STUDIO_ROOT);
    const name = path.relative(root, target).split(path.sep).join("/");
    console.log(`Created independent variant: ${target}`);
    console.log("  Render outputs, caches, virtual environments and secrets are excluded.");
    console.log(`  pnpm run check ${name}`);
    console.log(`  pnpm run render ${name} "note"`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}
