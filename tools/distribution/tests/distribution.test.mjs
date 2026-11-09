import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  matchingRule,
  normalizeRepoPath,
  resolveTier,
  filterSharedSkillsRegistry,
  mergeSkillsRegistries,
  tierIncluded,
  unsafeTextFindings,
  validateSharedSkillsRegistry,
  validateResourceManifest,
} from "../lib.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const repositoryPolicy = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "tools/distribution/policy.json"), "utf8"));
const publicManifestPath = path.join(REPO_ROOT, "tools/public-sync/manifest.json");
const publicManifest = fs.existsSync(publicManifestPath)
  ? JSON.parse(fs.readFileSync(publicManifestPath, "utf8"))
  : null;

function readResourceTiers(directory, root = directory) {
  const resources = new Map();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const [prefix, meta] of readResourceTiers(full, root)) resources.set(prefix, meta);
    } else if (entry.isFile() && entry.name === "resource.json") {
      const prefix = path.relative(root, directory).split(path.sep).join("/") || ".";
      resources.set(prefix, JSON.parse(fs.readFileSync(full, "utf8")));
    }
  }
  return resources;
}

function filesUnder(directory, relative = "") {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const childRelative = path.join(relative, entry.name);
    const child = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(child, childRelative) : [childRelative.split(path.sep).join("/")];
  });
}

const policy = {
  defaultTracked: "private",
  pathRules: [
    { path: "tools/", distribution: "public" },
    { path: "tools/private/", distribution: "private" },
    { path: "kit/", distribution: "private" },
  ],
};

test("normalizeRepoPath rejects repository escapes", () => {
  assert.throws(() => normalizeRepoPath("../secret"));
  assert.throws(() => normalizeRepoPath("/tmp/secret"));
  assert.equal(normalizeRepoPath("./kit/lib/a.js"), "kit/lib/a.js");
});

test("most specific path rule wins", () => {
  assert.equal(matchingRule("tools/a.js", policy.pathRules).distribution, "public");
  assert.equal(matchingRule("tools/private/a.js", policy.pathRules).distribution, "private");
});

test("skill registry tier overrides the skills directory default", () => {
  const result = resolveTier("skills/creator/SKILL.md", {
    policy: { defaultTracked: "private", pathRules: [{ path: "skills/", distribution: "private" }] },
    skillTiers: new Map([["creator", "public"]]),
  });
  assert.equal(result.tier, "public");
});

test("resource manifest overrides directory default", () => {
  const result = resolveTier("kit/characters/open/atlas.webp", {
    policy,
    resourceTiers: new Map([["kit/characters/open", { distribution: "pro" }]]),
  });
  assert.equal(result.tier, "pro");
});

test("distribution targets are cumulative but never include local", () => {
  assert.equal(tierIncluded("public", "public"), true);
  assert.equal(tierIncluded("pro", "public"), false);
  assert.equal(tierIncluded("public", "pro"), true);
  assert.equal(tierIncluded("pro", "pro"), true);
  assert.equal(tierIncluded("private", "pro"), false);
  assert.equal(tierIncluded("private", "private"), true);
  assert.equal(tierIncluded("local", "private"), false);
});

test("classification follows the policy available in this distribution", () => {
  if (publicManifest) {
    assert.equal(resolveTier("proyectos/video/BRIEF.md", { policy: repositoryPolicy }).tier, "local");
    assert.equal(resolveTier("ejemplos/selected/BRIEF.md", { policy: repositoryPolicy }).tier, "private");
    assert.ok(publicManifest.privateOnly.includes("proyectos/"));
    assert.ok(publicManifest.privateOnly.includes("ejemplos/"));
  } else {
    assert.equal(resolveTier("node_modules/example/index.js", { policy: repositoryPolicy }).tier, "local");
    assert.equal(resolveTier("unlisted/example.txt", { policy: repositoryPolicy }).tier, repositoryPolicy.defaultTracked);
  }
});

test("the duplicate free variant engine is absent; the canonical compatibility adapter stays private", () => {
  const duplicate = "scripts/variant.mjs";
  const packageJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
  assert.equal(fs.existsSync(path.join(REPO_ROOT, duplicate)), false);
  assert.equal(Object.hasOwn(packageJson.scripts || {}, "variant"), false);
  assert.equal(Object.hasOwn(packageJson.scripts || {}, "variant:test"), false);

  const adapter = "scripts/variante.mjs";
  if (fs.existsSync(path.join(REPO_ROOT, adapter))) {
    assert.equal(resolveTier(adapter, { policy: repositoryPolicy }).tier, "private");
    assert.equal(publicManifest.shared.some(item => item.private === adapter), false);
    assert.equal(publicManifest.sharedPackages.some(item => adapter === item.private || adapter.startsWith(`${item.private}/`)), false);
  }
});

test("public and pro resources require an explicit license", () => {
  assert.deepEqual(validateResourceManifest({ schemaVersion: 1, id: "x", type: "texture", distribution: "private" }), []);
  assert.equal(validateResourceManifest({ schemaVersion: 1, id: "x", type: "texture", distribution: "public" }).length, 1);
  assert.deepEqual(validateResourceManifest({ schemaVersion: 1, id: "x", type: "texture", distribution: "public", license: "CC0-1.0" }), []);
});

test("font files resolve to the intended effective distribution tiers", () => {
  const root = path.join(REPO_ROOT, "kit");
  const resourceTiers = readResourceTiers(root);
  const resolve = rel => resolveTier(rel, { policy: repositoryPolicy, resourceTiers });

  assert.deepEqual(resolve("fonts/inter.css"), {
    tier: "public",
    source: "fonts/resource.json",
  });
  const privateFonts = path.join(root, "fonts", "private");
  const privateFontFiles = filesUnder(privateFonts)
    .filter(file => file.endsWith(".woff2"))
    .map(file => `kit/fonts/private/${file}`);
  for (const file of privateFontFiles) {
    assert.equal(resolve(file).tier, "private", `${file} must remain private`);
  }
  for (const [prefix, manifest] of resourceTiers) {
    if (!prefix.startsWith("fonts/private/") || manifest.type !== "font") continue;
    assert.equal(resolve(`${prefix}/resource.json`).tier, "private", `${prefix} must remain private`);
    assert.equal(fs.existsSync(path.join(root, prefix, "OFL.txt")), true, `${prefix} retains its OFL notice`);
  }
  if (fs.existsSync(path.join(privateFonts, "fuentes.css"))) {
    assert.equal(resolve("fonts/private/fuentes.css").tier, "private");
  }

  if (publicManifest) {
    const publicFontMappings = publicManifest.shared.filter(item => item.private.startsWith("kit/fonts/")).map(item => item.private).sort();
    assert.deepEqual(publicFontMappings, [
      "kit/fonts/OFL.txt",
      "kit/fonts/inter-latin-400-normal.woff2",
      "kit/fonts/inter-latin-600-normal.woff2",
      "kit/fonts/inter-latin-800-normal.woff2",
      "kit/fonts/inter.css",
      "kit/fonts/resource.json",
    ]);
  }
});

test("unsafe distributable text catches secrets and machine paths", () => {
  const fakeMacPath = ["", "Users", "alexdc", "Dev", "project"].join("/");
  const fakeGithubToken = ["ghp", "1234567890123456789012345"].join("_");
  assert.deepEqual(unsafeTextFindings("normal /path/to/example"), []);
  assert.ok(unsafeTextFindings(fakeMacPath).includes("mac-user-path"));
  assert.ok(unsafeTextFindings(`token ${fakeGithubToken}`).includes("github-token"));
});

test("public skills registry contains only entries whose packages are shared", () => {
  const registry = { schemaVersion: 1, skills: [{ id: "shared" }, { id: "private-only" }] };
  const packages = [{ private: "skills/shared", public: "skills/shared" }];

  assert.deepEqual(filterSharedSkillsRegistry(registry, packages), {
    schemaVersion: 1,
    skills: [{ id: "shared" }],
  });
});

test("importing a public skills registry preserves private-only entries", () => {
  const privateRegistry = { schemaVersion: 1, skills: [{ id: "shared", description: "old" }, { id: "private-only" }] };
  const publicRegistry = { schemaVersion: 1, skills: [{ id: "shared", description: "updated" }] };

  assert.deepEqual(mergeSkillsRegistries(privateRegistry, publicRegistry), {
    schemaVersion: 1,
    skills: [{ id: "shared", description: "updated" }, { id: "private-only" }],
  });
});

test("distribution check rejects an unshared entry in the public registry", () => {
  const registry = { skills: [{ id: "shared" }, { id: "unshared" }] };
  const packages = [{ private: "skills/shared" }];

  assert.deepEqual(validateSharedSkillsRegistry(registry, packages), [
    "unshared: published skill has no shared package",
  ]);
});

test("distribution check rejects a shared package without a registry entry", () => {
  const registry = { skills: [{ id: "shared" }] };
  const packages = [{ private: "skills/shared" }, { private: "skills/missing" }];

  assert.deepEqual(validateSharedSkillsRegistry(registry, packages), [
    "missing: shared skill package has no registry entry",
  ]);
});
