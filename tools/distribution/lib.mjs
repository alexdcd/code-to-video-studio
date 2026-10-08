import path from "node:path";

export const TIERS = Object.freeze(["public", "pro", "private", "local"]);
const DISTRIBUTABLE = Object.freeze({
  public: new Set(["public"]),
  pro: new Set(["public", "pro"]),
  private: new Set(["public", "pro", "private"]),
});

export function normalizeRepoPath(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Repository path must be a non-empty string.");
  const raw = value.replaceAll("\\", "/");
  if (raw.startsWith("/") || /^[A-Za-z]:\//.test(raw)) throw new Error(`Absolute path is not allowed: ${value}`);
  const normalized = path.posix.normalize(raw).replace(/^\.\//, "");
  if (normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`Path escapes repository: ${value}`);
  }
  return normalized;
}

export function assertTier(value, label = "distribution") {
  if (!TIERS.includes(value)) throw new Error(`Invalid ${label} tier '${value}'. Expected ${TIERS.join(", ")}.`);
  return value;
}

function ruleMatches(rel, rulePath) {
  const rule = normalizeRepoPath(rulePath);
  if (rulePath.endsWith("/")) return rel.startsWith(rule.endsWith("/") ? rule : `${rule}/`);
  return rel === rule;
}

export function matchingRule(relPath, rules = []) {
  const rel = normalizeRepoPath(relPath);
  let winner = null;
  for (const rule of rules) {
    if (!rule || typeof rule.path !== "string") continue;
    if (!ruleMatches(rel, rule.path)) continue;
    const specificity = normalizeRepoPath(rule.path).length;
    if (!winner || specificity > winner.specificity) winner = { ...rule, specificity };
  }
  return winner;
}

export function resolveTier(relPath, { policy, skillTiers = new Map(), resourceTiers = new Map() }) {
  const rel = normalizeRepoPath(relPath);

  let resourceWinner = null;
  for (const [prefix, meta] of resourceTiers) {
    const normalizedPrefix = normalizeRepoPath(prefix);
    if (rel === normalizedPrefix || rel.startsWith(`${normalizedPrefix}/`)) {
      if (!resourceWinner || normalizedPrefix.length > resourceWinner.prefix.length) {
        resourceWinner = { prefix: normalizedPrefix, meta };
      }
    }
  }
  if (resourceWinner) {
    return { tier: assertTier(resourceWinner.meta.distribution), source: `${resourceWinner.prefix}/resource.json` };
  }

  if (rel.startsWith("skills/")) {
    const parts = rel.split("/");
    const id = parts[1];
    if (id && skillTiers.has(id)) return { tier: assertTier(skillTiers.get(id)), source: `skills/registry.json#${id}` };
  }

  const rule = matchingRule(rel, policy.pathRules || []);
  if (rule) return { tier: assertTier(rule.distribution), source: `policy:${rule.path}`, reason: rule.reason || null };

  return { tier: assertTier(policy.defaultTracked || "private"), source: "policy:defaultTracked" };
}

export function tierIncluded(tier, target) {
  assertTier(tier);
  if (!DISTRIBUTABLE[target]) throw new Error(`Invalid distribution target '${target}'. Expected public, pro or private.`);
  return DISTRIBUTABLE[target].has(tier);
}

export function validateResourceManifest(meta, rel = "resource.json") {
  const errors = [];
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return [`${rel}: manifest must be an object`];
  if (meta.schemaVersion !== 1) errors.push(`${rel}: schemaVersion must be 1`);
  if (typeof meta.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(meta.id)) errors.push(`${rel}: invalid id`);
  if (typeof meta.type !== "string" || !meta.type.trim()) errors.push(`${rel}: type is required`);
  if (!TIERS.includes(meta.distribution)) errors.push(`${rel}: invalid distribution tier`);
  if (["public", "pro"].includes(meta.distribution) && (typeof meta.license !== "string" || !meta.license.trim() || /^unknown$/i.test(meta.license.trim()))) {
    errors.push(`${rel}: public/pro resources require an explicit redistribution license`);
  }
  return errors;
}

export function unsafeTextFindings(text) {
  const findings = [];
  const checks = [
    ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ["github-token", /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/],
    ["api-token", /\bsk-[A-Za-z0-9_-]{20,}\b/],
    ["google-api-key", /\bAIza[0-9A-Za-z_-]{20,}\b/],
    ["slack-token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
    ["mac-user-path", /\/Users\/[A-Za-z0-9._-]+\//],
    ["linux-user-path", /\/home\/[A-Za-z0-9._-]+\//],
    ["windows-user-path", /[A-Za-z]:\\Users\\[^\\\s]+\\/],
  ];
  for (const [kind, regex] of checks) if (regex.test(text)) findings.push(kind);
  return findings;
}

function sharedSkillIds(sharedPackages = []) {
  const ids = new Set();
  for (const descriptor of sharedPackages) {
    const match = /^skills\/([^/]+)$/.exec(descriptor?.private || "");
    if (match) ids.add(match[1]);
  }
  return ids;
}

export function filterSharedSkillsRegistry(registry, sharedPackages = []) {
  if (!registry || typeof registry !== "object" || !Array.isArray(registry.skills)) {
    throw new Error("skills/registry.json: skills must be an array");
  }
  const sharedIds = sharedSkillIds(sharedPackages);
  return { ...registry, skills: registry.skills.filter(skill => sharedIds.has(skill?.id)) };
}

export function mergeSkillsRegistries(privateRegistry, publicRegistry) {
  if (!privateRegistry || typeof privateRegistry !== "object" || !Array.isArray(privateRegistry.skills)) {
    throw new Error("Private skills registry must contain a skills array");
  }
  if (!publicRegistry || typeof publicRegistry !== "object" || !Array.isArray(publicRegistry.skills)) {
    throw new Error("Public skills registry must contain a skills array");
  }
  const publicIds = new Set(publicRegistry.skills.map(skill => skill?.id).filter(Boolean));
  const privateOnly = privateRegistry.skills.filter(skill => !publicIds.has(skill?.id));
  return { ...privateRegistry, ...publicRegistry, skills: [...publicRegistry.skills, ...privateOnly] };
}

export function validateSharedSkillsRegistry(registry, sharedPackages = []) {
  const errors = [];
  if (!registry || typeof registry !== "object" || !Array.isArray(registry.skills)) {
    return ["skills must be an array"];
  }
  const sharedIds = sharedSkillIds(sharedPackages);
  const registeredIds = new Set();
  for (const skill of registry.skills) {
    if (!skill?.id) {
      errors.push("every published skill needs an id");
      continue;
    }
    registeredIds.add(skill.id);
    if (!sharedIds.has(skill.id)) errors.push(`${skill.id}: published skill has no shared package`);
  }
  for (const descriptor of sharedPackages) {
    const match = /^skills\/([^/]+)$/.exec(descriptor?.private || "");
    if (!match) continue;
    if (!registeredIds.has(match[1])) errors.push(`${match[1]}: shared skill package has no registry entry`);
  }
  return errors;
}
