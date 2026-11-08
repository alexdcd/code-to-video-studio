#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { approveProject, deriveProjectStatus } from "./lib/project-status.mjs";
import { resolveProjectPath } from "./lib/project-paths.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function parseArgs(args) {
  const positional = [];
  const options = { json: false, approval: null };
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--json") {
      options.json = true;
      continue;
    }
    if (argument === "--approve") {
      if (options.approval) throw new Error("Use one --approve target per command.");
      const target = args[++index];
      if (!target || target.startsWith("--")) throw new Error("Usage: --approve storyboard | --approve render vNN");
      const version = target === "render" ? args[++index] : null;
      if (target === "render" && (!version || version.startsWith("--"))) throw new Error("Render approval requires a version such as v07.");
      if (target !== "render" && target !== "storyboard") throw new Error("Approval target must be storyboard or render.");
      options.approval = { target, version };
      continue;
    }
    if (argument.startsWith("--")) throw new Error(`Unknown option ${argument}.`);
    positional.push(argument);
  }
  if (positional.length !== 1) throw new Error("Usage: pnpm run status <project> [--json] [--approve storyboard|render vNN]");
  return { project: positional[0], ...options };
}

function resolveProject(value) {
  return resolveProjectPath(value, { studioRoot: ROOT, requireIndex: false });
}

function humanOutput(status, approvalRecorded = null) {
  const { areas } = status;
  const ref = areas.brief.reference.status === "configured"
    ? `${areas.brief.reference.id} (${areas.brief.reference.fidelity ?? "unknown"})`
    : areas.brief.reference.status;
  const style = areas.style.id ? `${areas.style.id} (${areas.style.state})` : areas.style.status;
  const storyboardCounts = areas.storyboard.rows;
  const rows = storyboardCounts.total
    ? `${storyboardCounts.total} rows: ${storyboardCounts.reviewed} reviewed, ${storyboardCounts.animated} animated, ${storyboardCounts.built} built, ${storyboardCounts.outline} outline`
    : areas.storyboard.status;
  const findingCounts = areas.review.findings
    ? `${areas.review.findings.blockers} blockers, ${areas.review.findings.warnings} warnings, ${areas.review.findings.info} info`
    : "counts unknown";
  const lines = [
    `Production status: ${status.project}`,
    `Brief: ${areas.brief.status} (authoring ${areas.brief.authoring}; reference ${ref})`,
    `Style: ${style}`,
    `Script: ${areas.script.status}`,
    `Storyboard: ${areas.storyboard.status} (${rows}; approval ${areas.approvals.storyboard.status})`,
    `Audio: ${areas.audio.status} (${areas.audio.tracks} HTML tracks; plan ${areas.audio.plan})`,
   `Check: ${areas.check.status}`,
    `Renders: ${areas.renders.count} numbered version(s), ${areas.renders.unversioned.length} unnumbered; latest ${areas.renders.latestVersion ?? "unknown"}`,
    `Review: ${areas.review.status}${areas.review.renderVersion ? ` on ${areas.review.renderVersion}` : ""} (${findingCounts}; approval ${areas.approvals.render.status})`,
    `Stale results: ${status.stale.length ? status.stale.join(", ") : "none"}`,
    `Next step: ${status.nextStep.message}`,
  ];
  if (status.nextStep.command) lines.push(`Command: ${status.nextStep.command}`);
  if (approvalRecorded) lines.unshift(`Approval recorded: ${approvalRecorded}`);
  return lines.join("\n");
}

try {
  const args = parseArgs(process.argv.slice(2));
  const projectDir = resolveProject(args.project);
  let status;
  let approvalRecorded = null;
  if (args.approval) {
    status = approveProject({
      projectDir,
      studioRoot: ROOT,
      target: args.approval.target,
      version: args.approval.version,
    });
    approvalRecorded = args.approval.target === "storyboard"
      ? "storyboard revision"
      : `render ${args.approval.version.toLowerCase()}`;
  } else {
    status = deriveProjectStatus(projectDir, ROOT);
  }
  if (args.json) console.log(JSON.stringify({ ...status, ...(approvalRecorded ? { approvalRecorded } : {}) }, null, 2));
  else console.log(humanOutput(status, approvalRecorded));
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
