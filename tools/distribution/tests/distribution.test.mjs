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

test("public and pro resources require an explicit license", () => {
  assert.deepEqual(validateResourceManifest({ schemaVersion: 1, id: "x", type: "texture", distribution: "private" }), []);
  assert.equal(validateResourceManifest({ schemaVersion: 1, id: "x", type: "texture", distribution: "public" }).length, 1);
  assert.deepEqual(validateResourceManifest({ schemaVersion: 1, id: "x", type: "texture", distribution: "public", license: "CC0-1.0" }), []);
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
