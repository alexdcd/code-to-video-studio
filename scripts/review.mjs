#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  collectBlockers,
  assessSceneOpening,
  declaredAudioFromBrief,
  findMissingAssets,
  parseBriefAuthoring,
  parseBriefReference,
  parseStoryboardSubtitles,
  parseStoryboardTiming,
  sceneRows,
  transitionSampleOffsets,
} from "./lib/review-core.mjs";
import { resolveProjectFilePath, resolveProjectPath } from "./lib/project-paths.mjs";
import { normalizeRound, storyboardRoundPaths, verifyRoundEvidence } from "./lib/pose-evidence.mjs";
import { readSceneTimes } from "./lib/scene-times.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EN_PROJECT = path.join(ROOT, "scripts", "in-project.mjs");
const ANALYZE = path.join(ROOT, "scripts", "analyze.mjs");
const QA_VIDEO = path.join(ROOT, "scripts", "lib", "qa-video.py");
const PYTHON = process.env.PYTHON?.trim() || (process.platform === "win32" ? "python" : "python3");
const REVIEW_FPS = 10;
const MAX_TRANSITION_CUTS = 60;
const TRANSITIONS_PER_PAGE = 8;

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function parseArgs(args) {
  const positional = [];
  const options = { stage: "render", render: null, round: null, validate: false };
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--validate") {
      options.validate = true;
      continue;
    }
    if (argument === "--stage" || argument === "--render" || argument === "--round") {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}.`);
      options[argument.slice(2)] = argument === "--round" ? normalizeRound(value) : value;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option ${argument}.`);
    } else positional.push(argument);
  }
  if (positional.length !== 1) throw new Error("Usage: pnpm run review <project> [--stage storyboard] [--render vNN|path.mp4]");
  if (!new Set(["render", "storyboard"]).has(options.stage)) throw new Error("--stage must be storyboard.");
  if (options.round && options.stage !== "storyboard") throw new Error("--round is available only with --stage storyboard.");
  if (options.validate && (options.stage !== "storyboard" || !options.round)) {
    throw new Error("--validate requires --stage storyboard and --round NN.");
  }
  return { project: positional[0], ...options };
}

function resolveProject(value) {
  return resolveProjectPath(value, { studioRoot: ROOT });
}

function run(command, args, { cwd = ROOT, timeout = 300000 } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) {
    return { status: 1, stdout: result.stdout ?? "", stderr: result.error.message };
  }
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function runBinary(command, args, { cwd = ROOT, timeout = 120000 } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: null,
    timeout,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) return { status: 1, stdout: Buffer.alloc(0), stderr: result.error.message };
  return { status: result.status ?? 1, stdout: result.stdout ?? Buffer.alloc(0), stderr: String(result.stderr ?? "") };
}

function parseJson(result, label, allowFailure = false) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    if (allowFailure) return { parseError: `Could not parse ${label} JSON.`, rawOutput: result.stdout.slice(-4000) };
    throw new Error(`${label} did not return valid JSON. ${result.stderr.slice(-1000)}`);
  }
}

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function referenceIngredients(analysis) {
  const map = new Map();
  const blocks = analysis.split(/^### `([^`]+)`\s*$/m);
  for (let index = 1; index < blocks.length; index += 2) {
    const id = blocks[index];
    const content = blocks[index + 1] ?? "";
    const rule = content.match(/^\*\*Usage rule:\*\*\s*(.+(?:\n(?!\*\*|###).+)*)/m)?.[1]?.trim() ?? "Rule not found in analysis.";
    map.set(id, rule.replace(/\n/g, " "));
  }
  return map;
}

function renderReferenceConfig(config, ingredients) {
  if (config.status !== "configured") return "- Reference: unknown (no readable frontmatter reference block).";
  const lines = [
    `- Reference: \`${config.id}\`; fidelity: \`${config.fidelity ?? "unknown"}\`.`,
    `- Keep: ${config.keep.length ? config.keep.map(id => `\`${id}\``).join(", ") : "none declared"}.`,
    `- Transform: ${Object.keys(config.transform).length ? Object.entries(config.transform).map(([id, rule]) => `\`${id}\` → ${rule}`).join("; ") : "none declared"}.`,
    `- Ignore: ${config.ignore.length ? config.ignore.map(id => `\`${id}\``).join(", ") : "none declared"}.`,
  ];
  for (const id of config.keep) lines.push(`  - Usage rule for \`${id}\`: ${ingredients.get(id) ?? "not available in the reference analysis"}`);
  return lines.join("\n");
}

async function storyboardReview(projectDir, round = null) {
  const brief = readText(path.join(projectDir, "BRIEF.md"));
  const storyboard = readText(path.join(projectDir, "STORYBOARD.md"));
  if (!storyboard) throw new Error("STORYBOARD.md is missing.");
  const config = parseBriefReference(brief);
  const timing = parseStoryboardTiming(storyboard);
  const subtitles = parseStoryboardSubtitles(storyboard);
  const style = /^style\s*:\s*(.+)$/mi.exec(brief.match(/^---\s*\n([\s\S]*?)\n---/m)?.[1] ?? "")?.[1]?.trim() ?? null;
  const referencePath = config.id ? path.join(ROOT, "referencias", config.id, "ANALYSIS.md") : null;
  const ingredients = referenceIngredients(readText(referencePath ?? ""));
  const outputDir = round
    ? storyboardRoundPaths(projectDir, round).finalDir
    : path.join(projectDir, "renders", "storyboard-review");
  if (round && (!fs.existsSync(outputDir) || !fs.statSync(outputDir).isDirectory())) {
    throw new Error(`Storyboard evidence round ${round} does not exist; capture it with pnpm run poses <project> --round ${round}.`);
  }
  fs.mkdirSync(outputDir, { recursive: true });
  if (round && fs.existsSync(path.join(outputDir, "REVIEW.md"))) {
    throw new Error(`Round ${round} already has a REVIEW.md; historical reports are never overwritten.`);
  }
  const evidenceStatus = round
    ? await verifyRoundEvidence(projectDir, round)
    : { status: "UNKNOWN", reason: "No round evidence was selected." };
  const evidenceManifestPath = path.join(outputDir, "evidence-manifest.json");
  const evidenceManifest = round && fs.existsSync(evidenceManifestPath)
    ? JSON.parse(fs.readFileSync(evidenceManifestPath, "utf8"))
    : null;
  const timingSummary = timing.status === "measured"
    ? `${timing.durationSeconds} s across ${timing.rows} timed rows (a lower bound from the storyboard)${timing.declaredDurationSeconds != null ? `; the heading also declares ${timing.declaredDurationSeconds} s` : ""}.`
    : "unknown (no supported Tiempo/Time column was found).";
  const rowLines = timing.intervals.map(item => `| ${item.label || "—"} | ${item.startSeconds}–${item.endSeconds} s | ${(item.endSeconds - item.startSeconds).toFixed(2)} s |`);
  const captureLines = evidenceManifest?.shots?.map(shot =>
    `| ${shot.scene} | ${shot.kind} | ${Number(shot.seconds).toFixed(3)} s | [${shot.path}](${shot.path}) |`,
  ) ?? [];
  const comparisonLines = evidenceManifest?.comparisons?.map(item =>
    `- [${item.scene} · ${item.kind} · ${Number(item.seconds).toFixed(3)} s — before ${item.beforeRound}](${item.path}) (before: [${item.beforePath}](${item.beforePath}); after: [${item.afterPath}](${item.afterPath}))`,
  ) ?? [];
  const text = `# Storyboard review: ${path.basename(projectDir)}

Decision: NOT_REVIEWED

This report is a review template. A successful capture does not mean the images were inspected.

## Plan coverage

- Planned rhythm: ${timingSummary}
- Subtitles: ${subtitles.status === "measured" ? `${subtitles.withSubtitles} rows with, ${subtitles.withoutSubtitles} without (hidden ranges: ${JSON.stringify(subtitles.hideRanges)})` : "no «Subtítulo» column"}${subtitles.warning ? ` — WARNING: ${subtitles.warning}` : ""}
- Style: ${style ? `\`${style}\`` : "unknown (no frontmatter field)"}
- Reference:
${renderReferenceConfig(config, ingredients).split("\n").map(line => `  ${line}`).join("\n")}

## Visual evidence

- Evidence status: ${evidenceStatus.status}${evidenceStatus.reason ? ` — ${evidenceStatus.reason}` : ""}.
- Coverage: ${evidenceManifest?.coverage ?? "unknown"}.
${round ? "- [Contact sheet](hoja.jpg)" : "- Capture poses before completing animation; this report does not generate or inspect images."}
${captureLines.length ? `\n| Scene | Sample | Second | Evidence |\n| --- | --- | ---: | --- |\n${captureLines.join("\n")}` : "\nNo captured scene frames are linked in this report."}
${comparisonLines.length ? `\n### Before / after comparisons\n\n${comparisonLines.join("\n")}` : "\nNo matching before/after frame was available for this round."}

| Row | Planned interval | Lower-bound duration |
| --- | --- | ---: |
${rowLines.length ? rowLines.join("\n") : "| unknown | unknown | unknown |"}

## Review prompts

- [ ] Open the contact sheet and every supplied scene frame. If images cannot be opened, leave NOT_REVIEWED and state why.
- [ ] Confirm the evidence is FRESH; after source edits, capture the changed composition again before reviewing it.
- [ ] For each scene, check subject recognition in about one second and at small-screen size, hierarchy, occlusion, cropping, contrast, and safe margins.
- [ ] Check the storyboard's event, ordered readings, factual relationships, reveal timing, and whether required visual elements are present.
- [ ] Check continuity only where the brief declares it or a subject recurs; for characters, reuse mafia-ai-character-creator's identity, acting, contact, and continuity rubric.
- [ ] Check pose/action causality, anticipation, result, reaction, hand/object contact, and timing where evidence includes those moments. Use only explicit storyboard times for extra captures.
- [ ] Follow the selected style's GUIA.md and FRAME.md when present. Do not impose a different style, character requirement, cut rate, or density.
- [ ] Each kept ingredient has a concrete layout, timing, sound, or motion decision in the storyboard.
- [ ] Each transform rule is visible in a planned decision and does not contradict the reference choice.
- [ ] Subtitles are off wherever on-screen text or imagery already says what the voice says (see Subtitles above).
- [ ] Repeated subjects and signature devices have explicit usage limits.
- [ ] The intended reading order and every major scene change are clear.
- [ ] The storyboard has original content and does not reproduce reference-specific text, drawings, identity, or marks.

## Findings

| ID | Severity | Scene / second | Evidence path | Observed fact and impact | Concrete change | After repair |
| --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | No actionable findings. | — | — |

## Repair rounds

Limit automatic repair to two rounds. Keep the same scene and second in the before/after evidence, verify the new evidence, and inspect related scenes for regressions. Partial rounds cannot support a global decision; if round 02 was partial, make round 03 a full capture. Stop with REVISE if a blocker remains. After opening the images and completing this report, run \`pnpm run review <project> --stage storyboard --round ${round ?? "NN"} --validate\`. A subjective preference is a warning, not a blocker.

Reviewer: NOT_REVIEWED
`;
  fs.writeFileSync(path.join(outputDir, "REVIEW.md"), text, "utf8");
  console.log(`Storyboard review template saved to ${path.join(outputDir, "REVIEW.md")} (NOT_REVIEWED; images were not inspected).`);
  return round && evidenceStatus.status !== "FRESH" ? 2 : 0;
}

function markdownTableCells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => cell.trim());
}

function markdownSection(report, title) {
  const heading = `## ${title}`;
  const start = report.indexOf(heading);
  if (start < 0) return null;
  const bodyStart = report.indexOf("\n", start);
  if (bodyStart < 0) return "";
  const body = report.slice(bodyStart + 1);
  const nextHeading = body.search(/^## /m);
  return nextHeading < 0 ? body : body.slice(0, nextHeading);
}

function findingsFromReport(report) {
  const section = markdownSection(report, "Findings");
  if (!section) return { error: "The Findings section is missing." };
  const rows = section.split("\n").filter(line => /^\|/.test(line));
  const dataRows = rows.slice(2).map(markdownTableCells);
  if (!dataRows.length) return { error: "The Findings table has no data row." };
  const empty = dataRows.length === 1 && dataRows[0].length >= 7
    && dataRows[0][0] === "—" && dataRows[0][4] === "No actionable findings.";
  return empty ? { findings: [] } : { findings: dataRows };
}

function linkedTargets(cell) {
  return [...cell.matchAll(/\]\(([^)]+)\)/g)].map(match => match[1].split(/[?#]/, 1)[0]);
}

function isPathInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function readRoundShotLink(projectDir, currentRound, target, { currentOnly = false } = {}) {
  if (!target || path.isAbsolute(target) || target.includes("\\")) return false;
  const currentPaths = storyboardRoundPaths(projectDir, currentRound);
  const absolute = path.resolve(currentPaths.finalDir, target);
  if (!isPathInside(currentPaths.reviewRoot, absolute)) return false;
  const relative = path.relative(currentPaths.reviewRoot, absolute).split(path.sep);
  const matchedRound = relative[0]?.match(/^round-(\d{2})$/)?.[1];
  if (!matchedRound || Number(matchedRound) > Number(currentRound) || relative.length < 3) return false;
  if (currentOnly && matchedRound !== currentRound) return false;
  const validation = await verifyRoundEvidence(projectDir, matchedRound);
  if (validation.status === "UNKNOWN") return false;
  const manifestPath = path.join(currentPaths.reviewRoot, `round-${matchedRound}`, "evidence-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const imagePath = relative.slice(1).join("/");
  return manifest.shots.find(shot => shot.path === imagePath) ?? null;
}

function shotMatchesFinding(shot, sceneAndTime) {
  const divider = sceneAndTime.indexOf("/");
  if (divider < 0) return false;
  const sceneIds = sceneAndTime.slice(0, divider).trim().split(/\s*\+\s*/).filter(Boolean);
  const timeValues = [...sceneAndTime.slice(divider + 1).matchAll(/\d+(?:\.\d+)?/g)].map(match => Number(match[0]));
  const shotSceneIds = shot.sceneIds ?? [shot.scene];
  if (!sceneIds.length || !sceneIds.every(id => shotSceneIds.includes(id)) || !timeValues.length) return false;
  const seconds = Number(shot.seconds);
  if (!Number.isFinite(seconds)) return false;
  if (timeValues.length === 1) return Math.abs(seconds - timeValues[0]) < 0.0005;
  const [start, end] = timeValues;
  return seconds >= Math.min(start, end) - 0.0005 && seconds <= Math.max(start, end) + 0.0005;
}

async function validateStoryboard(projectDir, round) {
  const { finalDir } = storyboardRoundPaths(projectDir, round);
  const reportPath = path.join(finalDir, "REVIEW.md");
  if (!fs.existsSync(reportPath) || !fs.statSync(reportPath).isFile()) {
    console.error(`Cannot validate: ${reportPath} is missing.`);
    return 2;
  }
  const evidence = await verifyRoundEvidence(projectDir, round);
  if (evidence.status !== "FRESH") {
    console.error(`Cannot validate: round ${round} evidence is ${evidence.status}${evidence.reason ? ` — ${evidence.reason}` : ""}.`);
    return 2;
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(finalDir, "evidence-manifest.json"), "utf8"));
  if (manifest.coverage !== "all") {
    console.error("Cannot validate: a complete final storyboard capture is required; this round has selected coverage.");
    return 2;
  }
  let timelineScenes;
  try {
    timelineScenes = readSceneTimes(projectDir).scenes;
  } catch (error) {
    console.error(`Cannot validate: the current timeline could not be read (${error.message}).`);
    return 2;
  }
  const hasSample = (sceneId, kind, seconds) => manifest.shots.some(shot => {
    const samples = shot.samples ?? [{ scene: shot.scene, kind: shot.kind }];
    return samples.some(sample => sample.scene === sceneId && sample.kind === kind
      && Math.abs(Number(shot.seconds) - seconds) < 0.0005);
  });
  if (!timelineScenes.length || timelineScenes.some(scene =>
    !hasSample(scene.id, "arranque", scene.openingSeconds) || !hasSample(scene.id, "lleno", scene.fullSeconds))) {
    console.error("Cannot validate: the fresh evidence does not contain both baseline captures for every current timeline scene.");
    return 2;
  }
  const report = fs.readFileSync(reportPath, "utf8");
  const decision = report.match(/^Decision:\s*(.+?)\s*$/m)?.[1];
  if (!new Set(["PASS", "PASS WITH WARNINGS"]).has(decision)) {
    console.error(`Cannot validate: decision is ${decision ?? "missing"}.`);
    return 2;
  }
  const reviewer = report.match(/^Reviewer:\s*(.+?)\s*$/m)?.[1];
  if (!reviewer || /^(pending|not[\s_-]*reviewed|unknown|—)$/i.test(reviewer)) {
    console.error("Cannot validate: reviewer identity is missing or unresolved.");
    return 2;
  }
  const prompts = markdownSection(report, "Review prompts") ?? "";
  const checkboxes = prompts.match(/^- \[([ xX])\]/gm) ?? [];
  if (checkboxes.length < 13 || checkboxes.some(line => !/\[x\]/i.test(line))) {
    console.error("Cannot validate: all required review prompts must be present and checked after visual inspection.");
    return 2;
  }
  const parsedFindings = findingsFromReport(report);
  if (parsedFindings.error) {
    console.error(`Cannot validate: ${parsedFindings.error}`);
    return 2;
  }
  const findings = [];
  for (const [index, cells] of parsedFindings.findings.entries()) {
    if (cells.length < 7 || !/^SV-\d{3,}$/.test(cells[0]) || !new Set(["BLOCKER", "WARNING"]).has(cells[1])) {
      console.error(`Cannot validate: finding row ${index + 1} needs an ID (SV-NNN) and severity (BLOCKER or WARNING).`);
      return 2;
    }
    const status = cells[6].match(/\b(RESOLVED|ACCEPTED|OPEN|NOT_REVIEWED|UNKNOWN)\b/i)?.[1]?.toUpperCase();
    if (!status) {
      console.error(`Cannot validate: finding ${cells[0]} has no recognized after-repair status.`);
      return 2;
    }
    const originalEvidence = await Promise.all(linkedTargets(cells[3]).map(target => readRoundShotLink(projectDir, round, target)));
    const afterEvidence = await Promise.all(linkedTargets(cells[6]).map(target => readRoundShotLink(projectDir, round, target, { currentOnly: true })));
    const originalMatches = originalEvidence.some(shot => shot && shotMatchesFinding(shot, cells[2]));
    const afterMatches = afterEvidence.some(shot => shot && shotMatchesFinding(shot, cells[2]));
    if (!originalMatches || ((status === "RESOLVED" || status === "ACCEPTED") && !afterMatches)) {
      console.error(`Cannot validate: finding ${cells[0]} must link frames for its scene and second, with the recheck from this round.`);
      return 2;
    }
    findings.push({ id: cells[0], severity: cells[1], status });
  }
  const open = findings.filter(item => ["OPEN", "NOT_REVIEWED", "UNKNOWN"].includes(item.status));
  if (open.length) {
    console.error(`Cannot validate: unresolved findings remain (${open.map(item => item.id).join(", ")}).`);
    return 2;
  }
  const blockers = findings.filter(item => item.severity === "BLOCKER");
  if (blockers.length) {
    console.error(`Cannot validate: blocker findings remain (${blockers.map(item => item.id).join(", ")}).`);
    return 2;
  }
  if (decision === "PASS" && findings.some(item => item.status !== "RESOLVED")) {
    console.error("Cannot validate: PASS requires every finding to be RESOLVED.");
    return 2;
  }
  if (decision === "PASS WITH WARNINGS" && !findings.some(item => item.severity === "WARNING" && item.status === "ACCEPTED")) {
    console.error("Cannot validate: PASS WITH WARNINGS requires at least one explicitly ACCEPTED warning.");
    return 2;
  }
  console.log(`VALID: ${decision}; round ${round} is fresh, complete, and has no unresolved findings.`);
  return 0;
}

function resolveRender(projectDir, projectName, requested) {
  const rendersDir = path.join(projectDir, "renders");
  if (!requested) {
    const files = fs.readdirSync(rendersDir).filter(name => /-v\d{2}\.mp4$/i.test(name)).sort();
    const selected = files.at(-1);
    if (!selected) throw new Error(`No numbered render found in ${rendersDir}.`);
    return path.join(rendersDir, selected);
  }
  if (/^v\d{2}$/i.test(requested)) {
    const selected = path.join(rendersDir, `${projectName}-${requested.toLowerCase()}.mp4`);
    if (!fs.existsSync(selected)) throw new Error(`Numbered render does not exist: ${selected}`);
    return selected;
  }
  const resolved = path.isAbsolute(requested)
    ? requested
    : requested.startsWith("proyectos/")
      ? resolveProjectFilePath(requested, { studioRoot: ROOT })
      : path.resolve(projectDir, requested);
  if (!fs.existsSync(resolved)) throw new Error(`Render does not exist: ${resolved}`);
  return resolved;
}

function probeVideo(file) {
  const result = run("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", file]);
  if (result.status !== 0) throw new Error(`ffprobe failed: ${result.stderr}`);
  const report = JSON.parse(result.stdout);
  const video = report.streams?.find(stream => stream.codec_type === "video") ?? {};
  const audio = report.streams?.some(stream => stream.codec_type === "audio") ?? false;
  const rate = video.avg_frame_rate || video.r_frame_rate || "0/1";
  const [numerator, denominator] = rate.split("/").map(Number);
  return {
    durationSeconds: Number(report.format?.duration) || null,
    frameRate: denominator ? numerator / denominator : null,
    width: video.width ?? null,
    height: video.height ?? null,
    hasAudio: audio,
  };
}

function extractFrame(video, timestamp, output, label = "") {
  const filter = `scale=960:-2:flags=lanczos${label ? `,drawtext=text='${label}':x=16:y=16:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=6` : ""}`;
  const result = run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-ss", Math.max(0, timestamp).toFixed(3), "-i", video,
    "-frames:v", "1", "-vf", filter, "-q:v", "3", output,
  ]);
  if (result.status !== 0) throw new Error(`Could not extract frame at ${timestamp.toFixed(3)} s: ${result.stderr}`);
}

function makeContactSheet(directory, pattern, count, columns, output) {
  if (count === 0) return false;
  const rows = Math.ceil(count / columns);
  const result = run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-framerate", "1", "-i", path.join(directory, pattern),
    "-vf", `tile=${columns}x${rows}:padding=6:margin=6:color=0x111111`,
    "-frames:v", "1", "-q:v", "3", output,
  ]);
  if (result.status !== 0) throw new Error(`Could not create contact sheet: ${result.stderr}`);
  return true;
}

function capTransitions(cuts, maxCuts = MAX_TRANSITION_CUTS) {
  if (cuts.length <= maxCuts) return cuts;
  return Array.from({ length: maxCuts }, (_, index) => cuts[Math.round(index * (cuts.length - 1) / (maxCuts - 1))]);
}

function renderTransitionStrip(video, cut, durationSeconds, output) {
  const offsets = transitionSampleOffsets(cut.startSeconds);
  const sampleTimes = offsets.map(offset => Math.max(0, Math.min(durationSeconds - 0.05, cut.startSeconds + offset)));
  const sampleFrameNumbers = sampleTimes.map(time => Math.round(time * REVIEW_FPS));
  const firstFrame = Math.min(...sampleFrameNumbers);
  const seekSeconds = firstFrame / REVIEW_FPS;
  const indices = sampleFrameNumbers.map(frame => frame - firstFrame);
  const select = [...new Set(indices)].map(index => `eq(n\\,${index})`).join("+");
  const filter = [
    `fps=${REVIEW_FPS}:start_time=0`,
    `select='${select}'`,
    "scale=320:180:flags=lanczos",
    "tile=6x1:padding=6:margin=6:color=0x111111",
  ].join(",");
  const result = run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-ss", seekSeconds.toFixed(3), "-i", video,
    "-vf", filter, "-frames:v", "1", "-q:v", "3", output,
  ]);
  if (result.status !== 0) throw new Error(`Could not create transition strip at ${cut.startSeconds.toFixed(3)} s: ${result.stderr}`);
  return {
    id: cut.id,
    startSeconds: cut.startSeconds,
    offsetsSeconds: offsets,
    sampleTimesSeconds: sampleTimes.map((time, index) => Number((sampleFrameNumbers[index] / REVIEW_FPS).toFixed(3))),
  };
}

function transitionEvidence(video, cuts, durationSeconds, reviewDir, label) {
  if (!video || !Array.isArray(cuts)) return { status: "unknown", detectedCutCount: null, sampledCutCount: 0, pages: [], cuts: [] };
  const transitionsDir = path.join(reviewDir, "transitions", label);
  fs.mkdirSync(transitionsDir, { recursive: true });
  const sampled = capTransitions(cuts);
  const evidence = [];
  const pages = [];
  for (let pageStart = 0; pageStart < sampled.length; pageStart += TRANSITIONS_PER_PAGE) {
    const pageCuts = sampled.slice(pageStart, pageStart + TRANSITIONS_PER_PAGE);
    const pageNumber = Math.floor(pageStart / TRANSITIONS_PER_PAGE) + 1;
    const pageDir = path.join(transitionsDir, `page-${String(pageNumber).padStart(2, "0")}`);
    fs.mkdirSync(pageDir, { recursive: true });
    for (const [rowIndex, cut] of pageCuts.entries()) {
      const file = `cut-${String(rowIndex + 1).padStart(2, "0")}.jpg`;
      const details = renderTransitionStrip(video, cut, durationSeconds, path.join(pageDir, file));
      evidence.push({
        ...details,
        page: `transitions/${label}/page-${String(pageNumber).padStart(2, "0")}.jpg`,
        row: rowIndex + 1,
        image: `transitions/${label}/page-${String(pageNumber).padStart(2, "0")}/${file}`,
      });
    }
    const pagePath = path.join(transitionsDir, `page-${String(pageNumber).padStart(2, "0")}.jpg`);
    makeContactSheet(pageDir, "cut-%02d.jpg", pageCuts.length, 1, pagePath);
    pages.push(path.relative(reviewDir, pagePath));
  }
  return {
    status: "generated",
    detectedCutCount: cuts.length,
    sampledCutCount: sampled.length,
    samplingCapped: sampled.length < cuts.length,
    pages,
    cuts: evidence,
  };
}

function openingEdgeSamples(video, startSeconds, durationSeconds) {
  const frameWidth = 160;
  const frameHeight = 90;
  const frameSize = frameWidth * frameHeight;
  const start = Math.max(0, Math.min(durationSeconds - 0.55, startSeconds));
  const result = runBinary("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-ss", start.toFixed(3), "-i", video,
    "-vf", `fps=${REVIEW_FPS}:start_time=0,scale=${frameWidth}:${frameHeight}:flags=area,edgedetect=low=0.03:high=0.08:mode=wires,format=gray`,
    "-frames:v", "6", "-pix_fmt", "gray", "-f", "rawvideo", "pipe:1",
  ]);
  if (result.status !== 0) return [];
  const count = Math.floor(result.stdout.length / frameSize);
  return Array.from({ length: count }, (_, index) => {
    const frame = result.stdout.subarray(index * frameSize, (index + 1) * frameSize);
    let edgePixels = 0;
    for (const value of frame) if (value > 0) edgePixels++;
    return { offsetSeconds: index / REVIEW_FPS, edgeCoverage: edgePixels / frameSize };
  });
}

function openingEvidence(render, scenes, durationSeconds) {
  return scenes.map(scene => {
    const samples = openingEdgeSamples(render, scene.startSeconds, durationSeconds);
    return {
      scene: scene.id,
      startSeconds: scene.startSeconds,
      ...assessSceneOpening(samples),
      samples: samples.map(sample => ({
        offsetSeconds: Number(sample.offsetSeconds.toFixed(3)),
        edgeCoverage: Number(sample.edgeCoverage.toFixed(5)),
      })),
      transitionImage: scene.transitionImage ?? null,
    };
  });
}

function sceneEvidence(projectDir, render, timeline, outputDir) {
  const rows = sceneRows(timeline);
  const framesDir = path.join(outputDir, "scenes");
  fs.mkdirSync(framesDir, { recursive: true });
  const evidence = rows.map((row, index) => {
    const start = row.absStart ?? row.start;
    const end = row.absEnd ?? row.end;
    const timestamp = (start + end) / 2;
    const id = String(row.id ?? `scene-${index + 1}`).replace(/[^A-Za-z0-9_-]/g, "_");
    const filename = `scene-${String(index + 1).padStart(3, "0")}-${id}.jpg`;
    extractFrame(render, timestamp, path.join(framesDir, filename), `${id} | ${timestamp.toFixed(2)} s`);
    return { id, startSeconds: start, endSeconds: end, midpointSeconds: timestamp, frame: `scenes/${filename}` };
  });
  if (evidence.length) {
    const normalized = evidence.map((_, index) => {
      const from = path.join(framesDir, `scene-${String(index + 1).padStart(3, "0")}-${String(evidence[index].id).replace(/[^A-Za-z0-9_-]/g, "_")}.jpg`);
      const to = path.join(framesDir, `scene-${String(index + 1).padStart(3, "0")}.jpg`);
      fs.copyFileSync(from, to);
      return to;
    });
    makeContactSheet(framesDir, "scene-%03d.jpg", normalized.length, 4, path.join(framesDir, "contact-sheet.jpg"));
  }
  return evidence;
}

function findReferenceSource(id) {
  if (!id) return null;
  const directory = path.join(ROOT, "referencias", id);
  if (!fs.existsSync(directory)) return null;
  const source = fs.readdirSync(directory).find(name => /^source\.(mp4|mov|m4v|webm|mkv)$/i.test(name));
  return source ? path.join(directory, source) : null;
}

function sideBySideSheet(reference, render, referenceDuration, renderDuration, outputDir) {
  const pairsDir = path.join(outputDir, "pairs");
  fs.mkdirSync(pairsDir, { recursive: true });
  const fractions = Array.from({ length: 8 }, (_, index) => (index + 0.5) / 8);
  for (const [index, fraction] of fractions.entries()) {
    const referenceTime = referenceDuration * fraction;
    const renderTime = renderDuration * fraction;
    const label = `${Math.round(fraction * 100)}%`;
    const filter = [
      `[0:v]scale=480:270:force_original_aspect_ratio=decrease,pad=480:270:(ow-iw)/2:(oh-ih)/2,drawtext=text='REFERENCE ${label}':x=12:y=12:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=4[ref]`,
      `[1:v]scale=480:270:force_original_aspect_ratio=decrease,pad=480:270:(ow-iw)/2:(oh-ih)/2,drawtext=text='RENDER ${label}':x=12:y=12:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=4[ours]`,
      "[ref][ours]hstack=inputs=2[out]",
    ].join(";");
    const result = run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-ss", referenceTime.toFixed(3), "-i", reference,
      "-ss", renderTime.toFixed(3), "-i", render, "-filter_complex", filter,
      "-map", "[out]", "-frames:v", "1", "-q:v", "3", path.join(pairsDir, `pair-${String(index + 1).padStart(2, "0")}.jpg`),
    ]);
    if (result.status !== 0) throw new Error(`Could not create side-by-side pair ${index + 1}: ${result.stderr}`);
  }
  const result = run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-framerate", "1", "-i", path.join(pairsDir, "pair-%02d.jpg"),
    "-vf", "tile=2x4:padding=6:margin=6:color=0x111111", "-frames:v", "1", "-q:v", "3",
    path.join(outputDir, "reference-vs-render.jpg"),
  ]);
  if (result.status !== 0) throw new Error(`Could not assemble side-by-side sheet: ${result.stderr}`);
  return fractions.map((fraction, index) => ({
    pair: index + 1,
    relativePosition: fraction,
    referenceSeconds: referenceDuration * fraction,
    renderSeconds: renderDuration * fraction,
  }));
}

function qaSignals(report) {
  const signals = [];
  for (const span of report?.image?.longFrozenSpans ?? []) signals.push(`Frozen span ${span.startSeconds}–${span.endSeconds} s.`);
  for (const span of report?.image?.blackSpans ?? []) signals.push(`Black span ${span.startSeconds}–${span.endSeconds} s.`);
  if (report?.audio?.integratedLufs != null && report.audio.checks?.loudnessWithinTarget === false) {
    signals.push(`Integrated loudness ${report.audio.integratedLufs} LUFS is outside the QA target.`);
  }
  if (report?.audio?.truePeakDbfs != null && report.audio.checks?.truePeakAtOrBelowMinus1Dbfs === false) {
    signals.push(`True peak ${report.audio.truePeakDbfs} dBFS exceeds −1.0 dBFS.`);
  }
  for (const span of report?.audio?.silences ?? []) signals.push(`Detected silence ${span.startSeconds}–${span.endSeconds} s.`);
  return signals;
}

function writeRenderReview({ projectDir, render, reviewDir, check, checkExit, qa, timeline, probe, analysis, scenes, reference, pairs, transitions, openings, blockers, brief, referenceConfig, authoring }) {
  const compositionDuration = Number(timeline?.timeline?.duration) || null;
  const renderLabel = path.relative(ROOT, render) || render;
  const sceneLines = scenes.map(scene => `| ${scene.id} | ${scene.startSeconds.toFixed(3)}–${scene.endSeconds.toFixed(3)} s | ${scene.midpointSeconds.toFixed(3)} s | ${scene.frame} |`);
  const blockerLines = blockers.length
    ? blockers.map(item => `| BLOCKER | ${item.id} | ${item.message} |`).join("\n")
    : "| PASS | required technical blockers | No blocker detected; unknown values remain unverified. |";
  const signals = qaSignals(qa);
  const signalLines = signals.length ? signals.map(signal => `- ${signal}`).join("\n") : "- No frozen, black, loudness, peak, or silence signal was returned by QA.";
  const transitionLinks = [
    ...(transitions?.render?.pages ?? []).map((page, index) => `- [Render transition strips ${index + 1}](${page})`),
    ...(transitions?.reference?.pages ?? []).map((page, index) => `- [Reference transition strips ${index + 1}](${page})`),
  ];
  const openingLines = openings.filter(item => item.warning).map(item => {
    const duration = item.emptyDurationSeconds == null ? "unknown" : `${item.emptyDurationSeconds.toFixed(2)} s`;
    const image = item.transitionImage ? `; [transition strip](${item.transitionImage})` : "";
    const detail = item.status === "low-detail" ? "; low edge detail throughout the sample window" : "";
    return `- **WARNING** ${item.scene} at ${item.startSeconds.toFixed(3)} s: the visual-entry heuristic found ${duration} before sustained detail${detail}${image}. Verify against the strip.`;
  });
  const unknownOpeningLines = openings.filter(item => item.status === "unknown").map(item =>
    `- **UNKNOWN** ${item.scene} at ${item.startSeconds.toFixed(3)} s: edge-coverage samples were unavailable.`,
  );
  const openingSummary = openingLines.length
    ? openingLines.join("\n")
    : unknownOpeningLines.length
      ? unknownOpeningLines.join("\n")
      : "- No scene opening exceeded 0.20 s in the edge-coverage heuristic.";
  const ingredientTable = referenceConfig.status === "configured"
    ? `- Reference: \`${referenceConfig.id}\`; fidelity: \`${referenceConfig.fidelity ?? "unknown"}\`.
- Required keep ingredients: ${referenceConfig.keep.length ? referenceConfig.keep.map(id => `\`${id}\``).join(", ") : "none"}.
- Explicit transform rules: ${Object.keys(referenceConfig.transform).length ? Object.entries(referenceConfig.transform).map(([id, rule]) => `\`${id}\` → ${rule}`).join("; ") : "none"}.
- Ignored ingredients: ${referenceConfig.ignore.length ? referenceConfig.ignore.map(id => `\`${id}\``).join(", ") : "none declared"}.
- For \`essence\`, only \`keep\` is required; other traits are context unless a transform rule is stated.
- Compare at 8 equal relative positions. Reference analysis: \`${path.relative(ROOT, path.join(ROOT, "referencias", referenceConfig.id, "ANALYSIS.md"))}\`.
- The reference video is ${reference ? "available" : "missing"}; reference-pair sheet: ${pairs ? "generated" : "not generated"}.
- Transition strips: ${transitions?.reference?.sampledCutCount ?? "unknown"} reference cuts and ${transitions?.render?.sampledCutCount ?? "unknown"} render scene entries.`
    : "- Reference: unknown (no frontmatter block). No reference-based fidelity check was applied.";
  const checkSummary = checkExit === 0 ? "passed" : `failed (exit ${checkExit})`;
  const authoringReview = authoring === "bespoke"
    ? "- [ ] In bespoke mode, every creative kit piece used is named in the brief."
    : authoring === "template"
      ? "- Template mode: kit and parent-project reuse is allowed by default."
      : "- Authoring mode: unknown (legacy brief); no authoring-specific kit rule was applied.";
  const text = `# Creative review: ${path.basename(projectDir)}

Decision: [PASS | REVISE | PASS WITH WARNINGS]

Render: \`${renderLabel}\`

Review evidence: \`${path.relative(projectDir, reviewDir)}\`

## Technical blockers

HyperFrames check: ${checkSummary}.

Render duration: ${probe.durationSeconds ?? "unknown"} s.

Composition duration from HyperFrames timeline: ${compositionDuration ?? "unknown"} s.

Frame rate: ${probe.frameRate ?? "unknown"} fps.

Audio track: ${probe.hasAudio ? "present" : "absent"}.

True peak: ${qa?.audio?.truePeakDbfs ?? "unknown"} dBFS.

| Result | Check | Evidence |
| --- | --- | --- |
${blockerLines}

## Reference and fidelity

${ingredientTable}

Always check that the render does not reproduce the reference's specific text, drawings, marks, identity, or technical defects.

## Authoring mode

Mode: \`${authoring}\`.

${authoring === "bespoke"
    ? "In bespoke mode, mechanics and rigs may be reused; creative kit pieces require the brief to name them."
    : authoring === "template"
      ? "In template mode, reuse of the kit and parent project is allowed."
      : "This project predates the authoring field or has an unsupported value; its mode remains unknown."}

## Measured QA signals

${signalLines}

Details: [check.json](check.json), [qa.json](qa.json), [timeline.json](timeline.json), [analysis/analysis.json](analysis/analysis.json).

## Visual evidence

- [Scene contact sheet](scenes/contact-sheet.jpg)
- [Detected-shot contact sheet](analysis/frames/contact-sheet.jpg)
- [Reference vs render: 8 matched relative positions](reference-vs-render.jpg)
${transitionLinks.length ? transitionLinks.join("\n") : "- Transition strips: unknown (cut timing was unavailable)."}
- [Transition measurements and frame times](transitions.json)

## Scene-entry signal

The following heuristic samples six edge-coverage frames at 10 fps after each scene start. It marks an entry when detail stays below 1.2% of the frame or does not reach 65% of the local peak until after 0.20 s. This is a creative-review warning, never a technical blocker; verify every signal against the transition strips.

${openingSummary}

| Scene | Interval | Midpoint | Frame |
| --- | --- | ---: | --- |
${sceneLines.length ? sceneLines.join("\n") : "| unknown | unknown | unknown | no graphics rows returned by timeline |"}

## Creative checks

- [ ] Every scene's planned reading is visible in its frame; cite scene, second, and frame.
- [ ] No two scenes rely on the same primary subject without a clear reason.
- [ ] The signature device stays within its declared usage rule.
- [ ] On-screen text does not repeat narration or captions without a reason.
- [ ] The piece has an identity of its own and does not read as somebody else's video.
- [ ] It does not repeat the look of a previous Studio video without the brief naming that style.
${authoringReview}
- [ ] Check every keep ingredient and agreed transform rule at the frames above.
- [ ] Inspect the reference and render transition strips, including any scene-entry warning above.

## Findings

| Severity | Scene | Second / frame | Evidence and finding | Concrete fix |
| --- | --- | --- | --- | --- |
| — | — | — | Fresh reviewer: search similar cases after the first issue; cite each finding. | — |

Review rounds: 0 / 2

Reviewer: pending
Notes: ${brief.includes("reference:") ? "Review this artifact using only the brief, storyboard, reference analysis, and evidence in this folder." : "Review this artifact using the brief, storyboard, and evidence in this folder."}
`;
  fs.writeFileSync(path.join(reviewDir, "REVIEW.md"), text, "utf8");
  fs.writeFileSync(path.join(reviewDir, "check.json"), `${JSON.stringify(check, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(reviewDir, "qa.json"), `${JSON.stringify(qa, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(reviewDir, "timeline.json"), `${JSON.stringify(timeline, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(reviewDir, "analysis", "analysis.json"), `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(reviewDir, "pairs.json"), `${JSON.stringify(pairs ?? [], null, 2)}\n`, "utf8");
}

function renderReview(projectDir, projectName, requestedRender) {
  const render = resolveRender(projectDir, projectName, requestedRender);
  const stem = path.basename(render, path.extname(render));
  const version = stem.match(/-v(\d{2})$/i)?.[1];
  const reviewDirName = version ? `${projectName}-v${version}-review` : `${projectName}-adhoc-review`;
  const reviewDir = path.join(projectDir, "renders", reviewDirName);
  fs.mkdirSync(reviewDir, { recursive: true });
  const brief = readText(path.join(projectDir, "BRIEF.md"));
  const referenceConfig = parseBriefReference(brief);
  const authoring = parseBriefAuthoring(brief);

  const checkResult = run(process.execPath, [EN_PROJECT, "check", projectDir, "--json"], { timeout: 180000 });
  const check = parseJson(checkResult, "HyperFrames check", true);
  const qaResult = run(PYTHON, [QA_VIDEO, render, "--json"]);
  if (qaResult.status !== 0) throw new Error(`qa-video.py failed: ${qaResult.stderr || qaResult.stdout}`);
  const qa = parseJson(qaResult, "qa-video.py");
  const timelineResult = run(process.execPath, [EN_PROJECT, "timeline", projectDir, "--json"]);
  if (timelineResult.status !== 0) throw new Error(`HyperFrames timeline failed: ${timelineResult.stderr || timelineResult.stdout}`);
  const timeline = parseJson(timelineResult, "HyperFrames timeline");
  const probe = probeVideo(render);
  const analysisDir = path.join(reviewDir, "analysis");
  const analysisResult = run(process.execPath, [ANALYZE, render, "--mode", "render", "--output-dir", analysisDir], { timeout: 600000 });
  if (analysisResult.status !== 0) throw new Error(`Render analysis failed: ${analysisResult.stderr || analysisResult.stdout}`);
  const analysis = JSON.parse(fs.readFileSync(path.join(analysisDir, "analysis.json"), "utf8"));
  const scenes = sceneEvidence(projectDir, render, timeline, reviewDir);

  const reference = referenceConfig.status === "configured" ? findReferenceSource(referenceConfig.id) : null;
  let pairs = null;
  const referenceProbe = reference ? probeVideo(reference) : null;
  if (reference && referenceProbe?.durationSeconds && probe.durationSeconds) {
    pairs = sideBySideSheet(reference, render, referenceProbe.durationSeconds, probe.durationSeconds, reviewDir);
  }
  const renderCuts = scenes.slice(1).map(scene => ({ id: scene.id, startSeconds: scene.startSeconds }));
  let referenceCuts = null;
  let referenceAnalysis = null;
  if (referenceConfig.id) {
    const analysisPath = path.join(ROOT, "referencias", referenceConfig.id, "analysis.json");
    if (fs.existsSync(analysisPath)) {
      referenceAnalysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
      const calibrated = Number(referenceAnalysis.cuts?.calibratedDefault);
      const threshold = Number.isFinite(calibrated) ? calibrated.toFixed(2) : "0.15";
      const shots = referenceAnalysis.cuts?.thresholds?.[threshold]?.shots;
      if (Array.isArray(shots)) {
        referenceCuts = shots.slice(1).map((shot, index) => ({
          id: `shot-${String(index + 2).padStart(3, "0")}`,
          startSeconds: shot.startSeconds,
        })).filter(cut => Number.isFinite(cut.startSeconds));
      }
    }
  }
  const transitions = {
    render: transitionEvidence(render, renderCuts, probe.durationSeconds, reviewDir, "render"),
    reference: referenceCuts && referenceProbe?.durationSeconds
      ? transitionEvidence(reference, referenceCuts, referenceProbe.durationSeconds, reviewDir, "reference")
      : { status: "unknown", detectedCutCount: null, sampledCutCount: 0, pages: [], cuts: [] },
  };
  const transitionByScene = new Map((transitions.render.cuts ?? []).map(cut => [cut.id, cut.image]));
  scenes.forEach(scene => { scene.transitionImage = transitionByScene.get(scene.id) ?? null; });
  const openings = openingEvidence(render, scenes, probe.durationSeconds);
  fs.writeFileSync(path.join(reviewDir, "transitions.json"), `${JSON.stringify({
    schemaVersion: 1,
    frameRate: REVIEW_FPS,
    columnLabels: ["-0.1s", "cut", "+0.1s", "+0.2s", "+0.3s", "+0.5s"],
    firstCutOffsetsSeconds: transitionSampleOffsets(0),
    laterCutOffsetsSeconds: transitionSampleOffsets(1),
    cutsPerPage: TRANSITIONS_PER_PAGE,
    maxTransitionCuts: MAX_TRANSITION_CUTS,
    transitions,
    openings,
  }, null, 2)}\n`, "utf8");
  const missingAssets = findMissingAssets(check);
  if (referenceConfig.status === "configured" && !reference) missingAssets.push(`reference source for ${referenceConfig.id}`);
  if (referenceConfig.status === "configured" && !fs.existsSync(path.join(ROOT, "referencias", referenceConfig.id, "ANALYSIS.md"))) {
    missingAssets.push(`reference analysis for ${referenceConfig.id}`);
  }
  const blockers = collectBlockers({
    checkExit: checkResult.status,
    missingAssets,
    renderDuration: probe.durationSeconds,
    compositionDuration: Number(timeline?.timeline?.duration) || null,
    frameRate: probe.frameRate,
    truePeakDbfs: qa?.audio?.truePeakDbfs,
    declaredAudio: declaredAudioFromBrief(brief),
    hasAudio: qa?.video?.hasAudio ?? null,
  });
  writeRenderReview({ projectDir, render, reviewDir, check, checkExit: checkResult.status, qa, timeline, probe, analysis, scenes, reference, pairs, transitions, openings, blockers, brief, referenceConfig, authoring });
  console.log(`Creative review saved to ${path.join(reviewDir, "REVIEW.md")}`);
  if (blockers.length) {
    console.error(`${blockers.length} blocker(s). See REVIEW.md.`);
    return 1;
  }
  return 0;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const projectDir = resolveProject(args.project);
  const projectName = path.basename(projectDir);
  const exitCode = args.validate
    ? await validateStoryboard(projectDir, args.round)
    : args.stage === "storyboard"
      ? await storyboardReview(projectDir, args.round)
      : renderReview(projectDir, projectName, args.render);
  process.exitCode = exitCode;
} catch (error) {
  fail(error.message);
}
