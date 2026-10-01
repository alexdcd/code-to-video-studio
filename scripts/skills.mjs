#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY_PATH = path.join(ROOT, "skills", "registry.json");
const REGISTRY = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function safeRelative(value, label = "path") {
  if (typeof value !== "string" || !value || value.includes("\\") || path.posix.isAbsolute(value)) {
    fail(`Invalid ${label}: ${String(value)}`);
  }
  const parts = value.split("/");
  if (parts.some(part => !part || part === "." || part === "..")) fail(`Unsafe ${label}: ${value}`);
  return parts.join(path.sep);
}

function walkFiles(root) {
  const files = [];
  function visit(dir, prefix = "") {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) fail(`Symlinks are not allowed in skill packages: ${rel}`);
      if (entry.isDirectory()) visit(full, rel);
      else if (entry.isFile()) files.push(rel);
      else fail(`Unsupported file type in skill package: ${rel}`);
    }
  }
  visit(root);
  return files.sort();
}

function skillEntry(id) {
  const entry = REGISTRY.skills.find(skill => skill.id === id);
  if (!entry) fail(`Unknown skill '${id}'. Run 'npm run skills -- list'.`);
  const rel = safeRelative(entry.path, "registry path");
  const skillsRoot = path.resolve(ROOT, "skills");
  const skillRoot = path.resolve(skillsRoot, rel);
  if (!skillRoot.startsWith(`${skillsRoot}${path.sep}`)) fail(`Registry path escapes skills/: ${entry.path}`);
  return { entry, root: skillRoot };
}

function readManifest(skillRoot) {
  const manifestPath = path.join(skillRoot, "DISTRIBUTION-MANIFEST.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.schemaVersion !== 1 || typeof manifest.name !== "string" || !Array.isArray(manifest.files)) {
    fail(`Invalid distribution manifest: ${manifestPath}`);
  }
  return manifest;
}

function inspectDistribution(skillRoot, { expectedName } = {}) {
  const manifest = readManifest(skillRoot);
  if (expectedName && manifest.name !== expectedName) fail(`Manifest names '${manifest.name}', expected '${expectedName}'.`);
  const version = fs.readFileSync(path.join(skillRoot, "VERSION"), "utf8").trim();
  if (manifest.version !== version) fail(`Manifest version ${manifest.version} does not match VERSION ${version}.`);

  const declared = new Map();
  for (const item of manifest.files) {
    const rel = safeRelative(item.path, "manifest file path");
    if (rel === "DISTRIBUTION-MANIFEST.json" || declared.has(rel)) fail(`Duplicate or self-referential manifest path: ${rel}`);
    if (!/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.bytes) || item.bytes < 0) {
      fail(`Invalid SHA-256 or byte count for ${rel}`);
    }
    declared.set(rel, item);
  }

  const expected = [...declared.keys(), "DISTRIBUTION-MANIFEST.json"].sort();
  const actual = walkFiles(skillRoot);
  const unexpected = actual.filter(rel => !expected.includes(rel));
  const missing = expected.filter(rel => !actual.includes(rel));
  if (unexpected.length || missing.length) {
    fail(`Distribution file set mismatch.${unexpected.length ? ` Unexpected: ${unexpected.join(", ")}.` : ""}${missing.length ? ` Missing: ${missing.join(", ")}.` : ""}`);
  }
  for (const [rel, item] of declared) {
    const bytes = fs.readFileSync(path.join(skillRoot, safeRelative(rel)));
    if (bytes.length !== item.bytes || sha256(bytes) !== item.sha256) fail(`Distribution hash mismatch: ${rel}`);
  }
  return { manifest, files: expected };
}

function parseFlags(args) {
  const positional = [];
  const flags = new Map();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      if (arg === "--force") flags.set("force", true);
      else {
        const value = args[++i];
        if (!value || value.startsWith("--")) fail(`Missing value for ${arg}`);
        flags.set(arg.slice(2), value);
      }
    } else positional.push(arg);
  }
  return { positional, flags };
}

function runPython(args) {
  const result = spawnSync(process.env.PYTHON || "python3", args, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function destinationFor(id, target) {
  if (target === "claude") return path.join(os.homedir(), ".claude", "skills", id);
  if (target === "codex") return path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "skills", id);
  if (target === "claude-local") return path.join(ROOT, ".claude", "skills", id);
  fail(`Unknown install target '${target}'. Choose claude, codex, or claude-local.`);
}

function installSkill(id, target, force) {
  const { root: sourceRoot } = skillEntry(id);
  const current = inspectDistribution(sourceRoot, { expectedName: id });
  const destination = destinationFor(id, target);
  const parent = path.dirname(destination);
  fs.mkdirSync(parent, { recursive: true });

  if (fs.existsSync(destination)) {
    if (fs.lstatSync(destination).isSymbolicLink()) fail(`Refusing to replace symlink install path: ${destination}`);
    try {
      inspectDistribution(destination, { expectedName: id });
    } catch (error) {
      if (!force) fail(`Refusing to replace ${destination}: ${error.message} Use --force after reviewing local changes.`);
    }
  }

  const temp = path.join(parent, `.${id}.install-${process.pid}`);
  const backup = path.join(parent, `.${id}.backup-${process.pid}`);
  fs.rmSync(temp, { recursive: true, force: true });
  fs.mkdirSync(temp, { recursive: true });
  for (const rel of current.files) {
    const safe = safeRelative(rel);
    const targetPath = path.join(temp, safe);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(path.join(sourceRoot, safe), targetPath);
  }
  inspectDistribution(temp, { expectedName: id });

  let movedExisting = false;
  try {
    if (fs.existsSync(destination)) {
      fs.rmSync(backup, { recursive: true, force: true });
      fs.renameSync(destination, backup);
      movedExisting = true;
    }
    fs.renameSync(temp, destination);
    if (movedExisting) fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (movedExisting && !fs.existsSync(destination) && fs.existsSync(backup)) fs.renameSync(backup, destination);
    fs.rmSync(temp, { recursive: true, force: true });
    throw error;
  }
  console.log(`Installed ${id}@${current.manifest.version} to ${destination}`);
}

function inspectZip(zipPath, id, files) {
  const code = "import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps(sorted(z.namelist())))";
  const result = spawnSync(process.env.PYTHON || "python3", ["-c", code, zipPath], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  if (result.status !== 0) fail(result.stderr || "Could not inspect generated ZIP.");
  const actual = JSON.parse(result.stdout.trim());
  const expected = files.map(rel => `${id}/${rel}`).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`ZIP contents differ from distribution manifest. Got ${actual.length}, expected ${expected.length}.`);
  return actual.length;
}

function main() {
  const [command = "list", ...args] = process.argv.slice(2);
  const { positional, flags } = parseFlags(args);

  if (command === "list") {
    for (const item of REGISTRY.skills) {
      const { manifest } = inspectDistribution(skillEntry(item.id).root, { expectedName: item.id });
      console.log(`${item.id}@${manifest.version}  ${item.description}`);
    }
    return;
  }

  if (command === "manifest" && positional[0] === "update") {
    const id = positional[1];
    const { root } = skillEntry(id);
    const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
    const files = walkFiles(root).filter(rel => rel !== "DISTRIBUTION-MANIFEST.json").map(rel => {
      const bytes = fs.readFileSync(path.join(root, safeRelative(rel)));
      return { path: rel, sha256: sha256(bytes), bytes: bytes.length };
    });
    const manifest = { schemaVersion: 1, name: id, version, files };
    fs.writeFileSync(path.join(root, "DISTRIBUTION-MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Updated ${id} distribution manifest (${files.length} files, ${version}).`);
    return;
  }

  const id = positional[0];
  if (!id) fail(`Usage: npm run skills -- <list|validate|install|package|manifest update> [skill-id]`);
  const { root } = skillEntry(id);
  const inspected = inspectDistribution(root, { expectedName: id });

  if (command === "validate") {
    runPython([path.join("skills", id, "scripts", "validate_skill.py"), root]);
    console.log(`Validated ${id}@${inspected.manifest.version} (${inspected.files.length} files).`);
    return;
  }

  if (command === "install") {
    const target = flags.get("target");
    if (!target) fail("Install requires --target claude|codex|claude-local.");
    installSkill(id, target, flags.has("force"));
    return;
  }

  if (command === "package") {
    const output = flags.get("out") || path.join("dist", "skills", `${id}-${inspected.manifest.version}.zip`);
    const outputPath = path.resolve(ROOT, output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    runPython(["scripts/package_skill.py", root, outputPath]);
    const count = inspectZip(outputPath, id, inspected.files);
    console.log(`Packaged ${id}@${inspected.manifest.version} (${count} files): ${outputPath}`);
    return;
  }

  fail(`Unknown command '${command}'. Use list, validate, install, package, or manifest update.`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
