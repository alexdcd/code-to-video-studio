#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  TIERS,
  assertTier,
  normalizeRepoPath,
  resolveTier,
  tierIncluded,
  unsafeTextFindings,
  validateResourceManifest,
} from "./lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_POLICY = path.join(ROOT, "tools", "distribution", "policy.json");

function fail(message) {
  throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function parseArgs(argv) {
  const positional = [];
  const flags = new Map();
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const key = value.slice(2);
    if (key === "json") {
      flags.set(key, true);
      continue;
    }
    const next = argv[++i];
    if (!next || next.startsWith("--")) fail(`Missing value for --${key}`);
    flags.set(key, next);
  }
  return { positional, flags };
}

function trackedFiles() {
  const r = spawnSync("git", ["-C", ROOT, "ls-files", "-z"], { encoding: "buffer" });
  if (r.error) fail(`git ls-files failed: ${r.error.message}`);
  if (r.status !== 0) fail(`git ls-files failed with exit ${r.status}`);
  return r.stdout.toString("utf8").split("\0").filter(Boolean).map(normalizeRepoPath).sort();
}

function loadPolicy(file) {
  const policy = readJson(file);
  if (policy.schemaVersion !== 1 || !Array.isArray(policy.pathRules)) fail(`Invalid distribution policy: ${file}`);
  assertTier(policy.defaultTracked || "private", "defaultTracked");
  for (const rule of policy.pathRules) {
    normalizeRepoPath(rule.path);
    assertTier(rule.distribution, `rule ${rule.path}`);
  }
  return policy;
}

function loadSkills(errors) {
  const registryPath = path.join(ROOT, "skills", "registry.json");
  const tiers = new Map();
  if (!fs.existsSync(registryPath)) return tiers;
  const registry = readJson(registryPath);
  if (!Array.isArray(registry.skills)) {
    errors.push("skills/registry.json: skills must be an array");
    return tiers;
  }
  for (const item of registry.skills) {
    if (!item?.id || !item?.path) {
      errors.push("skills/registry.json: every skill needs id and path");
      continue;
    }
    if (!TIERS.includes(item.distribution)) {
      errors.push(`skills/registry.json#${item.id}: distribution must be public, pro, private or local`);
      continue;
    }
    tiers.set(item.id, item.distribution);
  }
  const skillsRoot = path.join(ROOT, "skills");
  if (fs.existsSync(skillsRoot)) {
    for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && !tiers.has(entry.name)) errors.push(`skills/${entry.name}: skill directory is not registered`);
    }
  }
  return tiers;
}

function loadResources(files, errors) {
  const resources = new Map();
  for (const rel of files.filter(file => file === "resource.json" || file.endsWith("/resource.json"))) {
    const full = path.join(ROOT, rel);
    let meta;
    try {
      meta = readJson(full);
    } catch (error) {
      errors.push(`${rel}: invalid JSON (${error.message})`);
      continue;
    }
    errors.push(...validateResourceManifest(meta, rel));
    const prefix = path.posix.dirname(rel);
    if (resources.has(prefix)) errors.push(`${rel}: duplicate resource classification for ${prefix}`);
    resources.set(prefix, meta);
  }
  return resources;
}

function textFile(rel) {
  return /\.(?:md|txt|json|ya?ml|toml|js|mjs|cjs|ts|tsx|jsx|py|sh|css|html|xml|svg)$/i.test(rel);
}

function publicSyncChecks(classified, skillTiers, errors) {
  const syncPath = path.join(ROOT, "tools", "public-sync", "manifest.json");
  if (!fs.existsSync(syncPath)) return;
  const sync = readJson(syncPath);
  const byPath = new Map(classified.map(item => [item.path, item]));

  for (const item of sync.shared || []) {
    const source = normalizeRepoPath(item.private);
    const row = byPath.get(source);
    if (!row) errors.push(`public-sync shared source is not tracked: ${source}`);
    else if (row.tier !== "public") errors.push(`public-sync source must be public: ${source} is ${row.tier}`);
  }

  for (const item of sync.sharedPackages || []) {
    const source = normalizeRepoPath(item.private);
    if (source.startsWith("skills/")) {
      const id = source.split("/")[1];
      if (skillTiers.get(id) !== "public") errors.push(`public-sync skill package must be public: ${id}`);
    } else {
      const rows = classified.filter(candidate => candidate.path === source || candidate.path.startsWith(`${source}/`));
      if (!rows.length || rows.some(row => row.tier !== "public")) errors.push(`public-sync package must resolve entirely to public: ${source}`);
    }
  }

  // privateOnly is a conservative legacy boundary for transfer tooling, not a classification override.
  // A creative subtree may contain an explicitly public resource in the future; it still cannot move
  // until that resource receives its own explicit shared mapping/package.
}

function classify(policyPath) {
  const errors = [];
  const warnings = [];
  const files = trackedFiles();
  const policy = loadPolicy(policyPath);
  const skillTiers = loadSkills(errors);
  const resourceTiers = loadResources(files, errors);
  const classified = files.map(rel => ({ path: rel, ...resolveTier(rel, { policy, skillTiers, resourceTiers }) }));

  for (const item of classified) {
    if (item.tier === "local") errors.push(`${item.path}: local-tier material must not be tracked`);
    if (!["public", "pro"].includes(item.tier) || !textFile(item.path)) continue;
    const full = path.join(ROOT, item.path);
    let text;
    try {
      text = fs.readFileSync(full, "utf8");
    } catch {
      continue;
    }
    const findings = unsafeTextFindings(text);
    if (findings.length) errors.push(`${item.path}: unsafe distributable text (${findings.join(", ")})`);
  }

  publicSyncChecks(classified, skillTiers, errors);

  const counts = Object.fromEntries(TIERS.map(tier => [tier, classified.filter(item => item.tier === tier).length]));
  return { policy, files, skillTiers, resourceTiers, classified, errors, warnings, counts };
}

function printCheck(result, json) {
  const payload = { ok: result.errors.length === 0, counts: result.counts, errors: result.errors, warnings: result.warnings };
  if (json) console.log(JSON.stringify(payload, null, 2));
  else {
    console.log(`Distribution check: ${payload.ok ? "OK" : "FAIL"}`);
    console.log(`  public ${result.counts.public} · pro ${result.counts.pro} · private ${result.counts.private} · local ${result.counts.local}`);
    for (const warning of result.warnings) console.log(`  WARN ${warning}`);
    for (const error of result.errors) console.error(`  ERROR ${error}`);
  }
  return payload.ok ? 0 : 1;
}

function printPlan(result, target, json) {
  if (!["public", "pro", "private"].includes(target)) fail("Plan target must be public, pro or private.");
  const included = result.classified.filter(item => tierIncluded(item.tier, target));
  const excluded = result.classified.filter(item => !tierIncluded(item.tier, target));
  const payload = {
    target,
    eligibleFiles: included.length,
    excludedFiles: excluded.length,
    counts: result.counts,
    files: included.map(item => item.path),
  };
  if (json) console.log(JSON.stringify(payload, null, 2));
  else {
    console.log(`Distribution plan: ${target}`);
    console.log(`  eligible ${included.length} · excluded ${excluded.length}`);
    console.log(`  tiers: public ${result.counts.public} · pro ${result.counts.pro} · private ${result.counts.private} · local ${result.counts.local}`);
    if (result.errors.length) console.log(`  NOTE: classification currently has ${result.errors.length} error(s); run npm run distribution:check.`);
  }
}

function main() {
  const [command = "check", ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);
  const policyPath = path.resolve(ROOT, flags.get("policy") || path.relative(ROOT, DEFAULT_POLICY));
  const result = classify(policyPath);

  if (command === "check") process.exitCode = printCheck(result, flags.has("json"));
  else if (command === "plan") printPlan(result, flags.get("target") || positional[0] || "public", flags.has("json"));
  else if (command === "explain") {
    const rel = positional[0];
    if (!rel) fail("Usage: distribution:explain -- <repo-path>");
    const resolved = resolveTier(rel, { policy: result.policy, skillTiers: result.skillTiers, resourceTiers: result.resourceTiers });
    console.log(`${normalizeRepoPath(rel)} → ${resolved.tier} (${resolved.source})${resolved.reason ? ` · ${resolved.reason}` : ""}`);
  } else fail("Usage: distribution <check|plan|explain>");
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
