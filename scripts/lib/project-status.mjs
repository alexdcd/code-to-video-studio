import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { declaredAudioFromBrief, parseBriefAuthoring, parseBriefReference } from "./review-core.mjs";

const EMPTY_FIELD = /^\s*[-*]\s*(?:\*\*[^*]+:\*\*\s*(?:\([^)]*\))?|\*\*[^*]+\*\*\s*:\s*(?:\([^)]*\))?)\s*$/;

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function readJson(file) {
  const text = readText(file);
  if (text == null) return { value: null, error: null };
  try {
    return { value: JSON.parse(text), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

function frontmatter(text) {
  return text?.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/)?.[1] ?? "";
}

function scalar(text, key) {
  return frontmatter(text).match(new RegExp(`^${key}\\s*:\\s*([^#\\n]+)`, "mi"))?.[1]
    ?.trim().replace(/^['"]|['"]$/g, "") ?? null;
}

function hasUnfilledSlots(text) {
  if (!text || /\{\{[^}]+\}\}/.test(text)) return true;
  for (const line of text.split(/\r?\n/)) {
    if (EMPTY_FIELD.test(line)) return true;
    if (/^\s*\|\s*\d+\s*\|\s*(?:\|\s*)+$/.test(line)) return true;
  }
  return false;
}

function substantiveMarkdown(text) {
  const body = (text ?? "").replace(/^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/, "");
  const found = [];
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^#{1,6}\s/.test(trimmed) || /^>/.test(trimmed)) continue;
    if (trimmed.startsWith("|")) {
      if (/^\|\s*:?-{2,}/.test(trimmed)) continue;
      const cells = trimmed.split("|").slice(1, -1).map(cell => cell.trim());
      if (cells[0] === "#" && cells.slice(1).some(cell => /^(text|notes|texto|notas)$/i.test(cell))) continue;
      if (cells.length > 1 && cells.slice(1).some(cell => cell && !/^\.\.\.$/.test(cell))) found.push(trimmed);
      continue;
    }
    if (EMPTY_FIELD.test(trimmed)) continue;
    if (/^[-*]\s*(?:TODO|TBD|to be written)\s*$/i.test(trimmed)) continue;
    found.push(trimmed);
  }
  return found.length > 0;
}

function briefStatus(brief) {
  if (brief == null) return "unknown";
  return hasUnfilledSlots(brief) || !substantiveMarkdown(brief) ? "incomplete" : "complete";
}

function scriptStatus(script) {
  if (script == null) return "unknown";
  return hasUnfilledSlots(script) || !substantiveMarkdown(script) ? "template" : "authored";
}

function styleFromBrief(brief, studioRoot) {
  let value = scalar(brief, "style");
  const explicitlyNamed = Boolean(value);
  if (!value) {
    const sourceLine = brief?.split(/\r?\n/).map(line => line.replace(/^\s*[-*]\s+/, ""))
      .find(line => /^\s*\*{0,2}(?:style|estilo)\*{0,2}\s*:\s*/i.test(line));
    const line = sourceLine?.match(/^\s*\*{0,2}(?:style|estilo)\*{0,2}\s*:\s*\*{0,2}(.+?)\*{0,2}\s*$/i)?.[1]?.trim();
    if (line && !/^\(/.test(line)) value = line;
  }
  if (!value) return { status: "unknown", id: null, state: "unknown" };
  if (/^(none|no style|ninguno|ninguna|sin estilo)$/i.test(value)) return { status: "none", id: null, state: "none" };
  const tick = String.fromCharCode(96);
  const explicit = value.match(new RegExp(tick + "([a-z0-9][a-z0-9-]*)" + tick, "i"))?.[1];
  const candidate = explicit ?? value.match(/^([a-z0-9][a-z0-9-]*)\b/i)?.[1];
  if (!candidate || candidate.startsWith("{{")) return { status: "unknown", id: null, state: "unknown" };
  const fichaPath = path.join(studioRoot, "kit", "estilos", candidate, "ficha.json");
  const ficha = readJson(fichaPath).value;
  if (!ficha) return { status: "unknown", id: explicitlyNamed || explicit ? candidate : null, state: "unknown" };
  return { status: "named", id: candidate, state: ficha.estado ?? ficha.status ?? "unknown" };
}

function mapStoryboardState(value) {
  const text = (value ?? "").trim().toLowerCase();
  if (/^(reviewed|revisado|revisada|aprobado|aprobada)$/.test(text)) return "reviewed";
  if (/^(animated|animado|animada)$/.test(text)) return "animated";
  if (/^(built|composed|construido|construida|compuesto|compuesta)$/.test(text)) return "built";
  if (/^(outline|planned|draft|boceto|planificado|planificada)$/.test(text)) return "outline";
  return null;
}

function compositionExists(projectDir, value) {
  const candidate = path.basename((value ?? "").replace(/`/g, "").trim());
  if (!candidate) return false;
  const filename = path.extname(candidate) ? candidate : `${candidate}.html`;
  return fs.existsSync(path.join(projectDir, "compositions", filename));
}

function storyboardRows(storyboard, projectDir) {
  if (!storyboard) return { status: "unknown", rows: [], counts: emptyStoryboardCounts() };
  const lines = storyboard.split(/\r?\n/);
  let headerIndex = -1;
  let headers = [];
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].startsWith("|")) continue;
    const cells = lines[index].split("|").slice(1, -1).map(cell => cell.trim().toLowerCase());
    if (cells.some(cell => /^(file|archivo|scene|escena|id|#|no\.)$/.test(cell))
      && cells.some(cell => /^(time|tiempo)$/.test(cell))) {
      headerIndex = index;
      headers = cells;
      break;
    }
  }
  if (headerIndex < 0) return { status: "unknown", rows: [], counts: emptyStoryboardCounts() };
  const fileIndex = headers.findIndex(cell => /^(file|archivo|scene|escena|id)$/.test(cell));
  const stateIndex = headers.findIndex(cell => /^(status|estado)$/.test(cell));
  const rows = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.startsWith("|")) break;
    if (/^\|\s*:?-{2,}/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map(cell => cell.trim());
    if (cells.length !== headers.length) continue;
    const first = cells[0] ?? "";
    const rowNumber = first.match(/^(\d{1,2})(?:\s*[-–—]\s*\d{1,2})?$/)?.[1];
    const file = fileIndex >= 0 ? cells[fileIndex]
      : /^s\d+$/i.test(first) ? first
        : rowNumber ? `s${rowNumber.padStart(2, "0")}` : first;
    const id = path.basename(file.replace(/`/g, "").trim()).replace(/\.html?$/i, "");
    if (!id || /^(?:#|no\.?|row)$/i.test(id)) continue;
    const composition = compositionExists(projectDir, file);
    const declaredState = stateIndex >= 0 ? mapStoryboardState(cells[stateIndex]) : null;
    rows.push({ id, status: declaredState ?? (composition ? "built" : "outline"), compositionExists: composition });
  }
  const counts = emptyStoryboardCounts();
  counts.total = rows.length;
  for (const row of rows) {
    counts[row.status]++;
    if (!row.compositionExists) counts.missingComposition++;
  }
  if (!rows.length) return { status: "incomplete", rows, counts };
  const statuses = rows.map(row => row.status);
  const status = statuses.every(item => item === "reviewed") ? "reviewed"
    : statuses.every(item => item === "reviewed" || item === "animated") ? "animated"
      : statuses.every(item => ["reviewed", "animated", "built"].includes(item)) ? "built"
        : statuses.every(item => item === "outline") ? "outline" : "in_progress";
  return { status, rows, counts };
}

function emptyStoryboardCounts() {
  return { total: 0, outline: 0, built: 0, animated: 0, reviewed: 0, missingComposition: 0 };
}

function audioFields(brief) {
  const front = frontmatter(brief);
  const values = {};
  for (const line of front.split(/\r?\n/)) {
    const match = line.match(/^\s*(voice|music|audio)\s*:\s*(.+)$/i);
    if (match) values[match[1].toLowerCase()] = match[2].trim();
  }
  for (const line of (brief ?? "").split(/\r?\n/)) {
    const match = line.replace(/\*\*/g, "").trim().match(/^(voice|voz|music(?:\s+and\s+sound)?|m[uú]sica(?:\s+y\s+sonido)?|audio)\s*:\s*(.+)$/i);
    if (!match) continue;
    const key = /^(voice|voz)$/i.test(match[1]) ? "voice"
      : /^audio$/i.test(match[1]) ? "audio" : "music";
    values[key] ??= match[2].trim();
  }
  return values;
}

function isNoAudioValue(value) {
  return /^(?:none|no|false|n\/a|silent|sin\s+(?:voz|m[uú]sica|audio)|ningun[oa]?)\b/i.test(value ?? "");
}

function declaresNoAudio(brief) {
  if (/\b(?:silent visual (?:study|test)|no audio by design|sin audio por dise[nñ]o)\b/i.test(brief ?? "")) return true;
  const values = audioFields(brief);
  return Boolean(values.audio && isNoAudioValue(values.audio))
    || Boolean(values.voice && values.music && isNoAudioValue(values.voice) && isNoAudioValue(values.music));
}

function sourceFiles(projectDir) {
  const files = [];
  const visit = directory => {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if ([".git", ".hyperframes", "node_modules", "renders"].includes(entry.name) || entry.name === ".DS_Store") continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (fs.existsSync(path.join(file, "index.html"))) continue;
        visit(file);
      }
      else if (entry.isFile() && file !== path.join(projectDir, "meta.json")) files.push(file);
    }
  };
  visit(projectDir);
  return files;
}

function latestSourceMtime(projectDir) {
  let latest = 0;
  for (const file of sourceFiles(projectDir)) {
    try {
      latest = Math.max(latest, fs.statSync(file).mtimeMs);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return latest;
}

function readRenders(projectDir) {
  const directory = path.join(projectDir, "renders");
  const ledger = readText(path.join(directory, "VERSIONES.txt"));
  const versions = [...new Set((ledger ?? "").split(/\r?\n/)
    .map(line => line.match(/^\s*(v\d{2})\s*[·|]/i)?.[1]?.toLowerCase())
    .filter(Boolean))]
    .sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)));
  const unversioned = fs.existsSync(directory)
    ? fs.readdirSync(directory).filter(name => /\.mp4$/i.test(name) && !/-v\d{2}\.mp4$/i.test(name)).sort()
    : [];
  return {
    status: versions.length ? "available" : unversioned.length ? "unknown" : "none",
    versions,
    latestVersion: versions.at(-1) ?? null,
    count: versions.length,
    unversioned,
    directory,
  };
}

function checkState(projectDir, sourceMtime) {
  const file = path.join(projectDir, "renders", "check.json");
  const { value, error } = readJson(file);
  if (error) return { status: "unknown", result: "unknown", stale: false, path: "renders/check.json", detail: "invalid JSON" };
  if (value == null) return { status: "unknown", result: "unknown", stale: false, path: "renders/check.json" };
  const stat = fs.statSync(file);
  const stale = sourceMtime > stat.mtimeMs;
  const result = typeof value.ok === "boolean" ? (value.ok ? "passed" : "failed")
    : typeof value.success === "boolean" ? (value.success ? "passed" : "failed") : "unknown";
  const status = stale ? "stale" : result;
  return { status, result, stale, path: "renders/check.json" };
}

function reviewFiles(projectDir) {
  const root = path.join(projectDir, "renders");
  const found = [];
  const visit = directory => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name === "REVIEW.md") found.push(file);
    }
  };
  visit(root);
  return found.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
}

function latestReview(projectDir, renders) {
  const file = reviewFiles(projectDir)[0];
  if (!file) return { status: "unknown", decision: "unknown", stale: false, path: null, findings: null, renderVersion: null };
  const text = readText(file) ?? "";
  const decision = text.match(/^Decision:\s*\**(PASS WITH WARNINGS|PASS|REVISE)\**\s*$/mi)?.[1]?.toUpperCase() ?? "unknown";
  const renderLine = text.match(/^Render:\s*`([^`]+)`/mi)?.[1] ?? null;
  const version = renderLine?.match(/-v(\d{2})\.mp4$/i)?.[1];
  let stale = false;
  if (version && renders.latestVersion) {
    stale = `v${version}` !== renders.latestVersion
      || !fs.existsSync(path.join(projectDir, "renders", `${path.basename(projectDir)}-v${version}.mp4`));
  }
  else if (renderLine && renders.latestVersion) {
    const renderPath = path.isAbsolute(renderLine) ? renderLine : renderLine.startsWith("proyectos/")
      ? path.resolve(path.dirname(path.dirname(projectDir)), renderLine)
      : path.resolve(projectDir, renderLine);
    const latestRender = path.join(renders.directory, `${path.basename(projectDir)}-${renders.latestVersion}.mp4`);
    try {
      stale = fs.existsSync(renderPath) && fs.existsSync(latestRender)
        && fs.statSync(renderPath).mtimeMs < fs.statSync(latestRender).mtimeMs;
    } catch {
      stale = false;
    }
  }
  const findings = {
    blockers: [...text.matchAll(/^\|\s*\**BLOCKER\**\s*\|/gmi)].length,
    warnings: [...text.matchAll(/^\|\s*\**WARNING\**\s*\|/gmi)].length,
    info: [...text.matchAll(/^\|\s*\**INFO\**\s*\|/gmi)].length,
  };
  return {
    status: stale ? "stale" : decision,
    decision,
    stale,
    path: path.relative(projectDir, file).split(path.sep).join("/"),
    findings,
    renderVersion: version ? `v${version}` : null,
  };
}

function approvalStates(projectDir, metadata, storyboard, renders) {
  const approvals = metadata?.approvals;
  if (!approvals || typeof approvals !== "object" || approvals.schemaVersion !== 1) {
    return {
      storyboard: { status: "unknown", fingerprint: null },
      render: { status: "unknown", version: null },
    };
  }
  const currentHash = storyboard == null ? null : createHash("sha256").update(storyboard).digest("hex");
  const savedStoryboardHash = approvals.storyboard?.sha256 ?? null;
  const storyboardStatus = !savedStoryboardHash || !currentHash ? "unknown"
    : savedStoryboardHash === currentHash ? "approved" : "stale";
  const rawVersion = approvals.render?.version;
  const version = typeof rawVersion === "string" ? rawVersion.toLowerCase() : null;
  const renderExists = version && renders.versions.includes(version);
  const renderStatus = !version ? "unknown"
      : !renderExists || !fs.existsSync(path.join(projectDir, "renders", `${path.basename(projectDir)}-${version}.mp4`)) ? "stale"
      : version === renders.latestVersion ? "approved" : "stale";
  return {
    storyboard: { status: storyboardStatus, fingerprint: savedStoryboardHash },
    render: { status: renderStatus, version },
  };
}

function audioState(projectDir, brief) {
  const htmlFiles = [path.join(projectDir, "index.html"), ...sourceFiles(projectDir).filter(file => file.endsWith(".html"))];
  const sources = new Set();
  for (const file of new Set(htmlFiles)) {
    const html = readText(file) ?? "";
    for (const block of html.matchAll(/<audio\b[\s\S]*?<\/audio\s*>|<audio\b[^>]*>/gi)) {
      for (const match of block[0].matchAll(/\bsrc\s*=\s*["']([^"']+)["']/gi)) sources.add(match[1]);
    }
  }
  const localSources = [...sources].filter(source => !/^(?:[a-z]+:|\/\/)/i.test(source));
  const missing = localSources.filter(source => {
    let decoded = source.split(/[?#]/, 1)[0];
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      return true;
    }
    return !fs.existsSync(path.resolve(projectDir, decoded));
  });
  const musicPlan = fs.existsSync(path.join(projectDir, "musica", "music-plan.json"));
  const declared = localSources.length > 0 || musicPlan;
  const noAudio = declaresNoAudio(brief);
  const briefDeclaresAudio = declaredAudioFromBrief(brief ?? "")
    || Object.values(audioFields(brief ?? "")).some(value => !isNoAudioValue(value));
  const status = missing.length ? "missing-assets"
    : declared ? (sources.size ? "declared" : "planned")
      : noAudio ? "silent" : briefDeclaresAudio ? "missing" : "unknown";
  return { status, tracks: sources.size, plan: musicPlan ? "present" : "unknown", missingAssets: missing };
}

function nextAction(areas) {
  if (["unknown", "incomplete"].includes(areas.brief.status)) return { id: "complete-brief", command: null, message: "Complete BRIEF.md." };
  if (["unknown", "template"].includes(areas.script.status)) return { id: "write-script", command: null, message: "Write or complete GUION.md." };
  if (["unknown", "incomplete", "outline", "in_progress"].includes(areas.storyboard.status)) {
    return { id: "complete-storyboard", command: null, message: "Complete storyboard rows and their scene compositions." };
  }
  if (["failed", "stale", "unknown"].includes(areas.check.status)) {
    return { id: "run-check", command: `pnpm run check ${areas.projectName}`, message: "Run the HyperFrames check." };
  }
  if (areas.review.status === "stale" && areas.renders.count > 0) {
    return { id: "review", command: `pnpm run review ${areas.projectName}`, message: "Review the latest numbered render." };
  }
  if (areas.review.decision === "REVISE") return { id: "revise", command: null, message: "Address the review findings and render a new version." };
  if (areas.renders.count === 0 && areas.renders.unversioned.length && areas.review.status === "unknown") {
    const renderPath = `renders/${areas.renders.unversioned.at(-1)}`;
    return { id: "review", command: `pnpm run review ${areas.projectName} --render ${renderPath}`, message: "Review the available unnumbered render." };
  }
  if (areas.renders.count === 0 && !areas.renders.unversioned.length) {
    return { id: "render", command: `pnpm run render ${areas.projectName} "note"`, message: "Create the first numbered render." };
  }
  if (["unknown", "stale"].includes(areas.review.status)) {
    return { id: "review", command: `pnpm run review ${areas.projectName}`, message: "Review the latest numbered render." };
  }
  if (areas.renders.count === 0 && areas.renders.unversioned.length) {
    return { id: "number-render", command: `pnpm run render ${areas.projectName} "note"`, message: "Create a numbered render after resolving the current review." };
  }
  if (areas.approvals.render.status !== "approved" && areas.renders.latestVersion) {
    return {
      id: "approve-render",
      command: `pnpm run status ${areas.projectName} --approve render ${areas.renders.latestVersion}`,
      message: `Approve ${areas.renders.latestVersion} when it is ready.`,
    };
  }
  return { id: "none", command: null, message: "No next step is implied by the available project files." };
}

export function deriveProjectStatus(projectDir, studioRoot) {
  const name = path.basename(projectDir);
  const brief = readText(path.join(projectDir, "BRIEF.md"));
  const script = readText(path.join(projectDir, "GUION.md"));
  const storyboardText = readText(path.join(projectDir, "STORYBOARD.md"));
  const metadata = readJson(path.join(projectDir, "meta.json")).value;
  const style = styleFromBrief(brief ?? "", studioRoot);
  const reference = parseBriefReference(brief ?? "");
  const storyboard = storyboardRows(storyboardText, projectDir);
  const renders = readRenders(projectDir);
  const sourceMtime = latestSourceMtime(projectDir);
  const check = checkState(projectDir, sourceMtime);
  const review = latestReview(projectDir, renders);
  const approvals = approvalStates(projectDir, metadata, storyboardText, renders);
  const audio = audioState(projectDir, brief ?? "");
  const stale = [];
  if (check.stale) stale.push("check");
  if (review.stale) stale.push("review");
  if (approvals.storyboard.status === "stale") stale.push("storyboard-approval");
  if (approvals.render.status === "stale") stale.push("render-approval");
  const areas = {
    projectName: name,
    brief: { status: briefStatus(brief), authoring: brief == null ? "unknown" : parseBriefAuthoring(brief), reference },
    style,
    script: { status: scriptStatus(script) },
    storyboard: { status: storyboard.status, rows: storyboard.counts, approval: approvals.storyboard.status },
    audio,
    check,
    renders: { status: renders.status, versions: renders.versions, latestVersion: renders.latestVersion, count: renders.count, unversioned: renders.unversioned },
    review,
    approvals,
  };
  return { schemaVersion: 1, project: name, areas, stale, nextStep: nextAction(areas) };
}

export function approveProject({ projectDir, studioRoot, target, version }) {
  const metadataPath = path.join(projectDir, "meta.json");
  const stat = fs.lstatSync(metadataPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error("meta.json must be a regular local file to record an approval.");
  const parsed = readJson(metadataPath);
  if (parsed.error || !parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
    throw new Error("meta.json is not valid project metadata.");
  }
  const meta = parsed.value;
  if (meta.approvals != null && (typeof meta.approvals !== "object" || Array.isArray(meta.approvals)
    || (meta.approvals.schemaVersion != null && meta.approvals.schemaVersion !== 1))) {
    throw new Error("meta.json contains an unsupported approvals schema.");
  }
  const approvals = { ...(meta.approvals ?? {}), schemaVersion: 1 };
  if (target === "storyboard") {
    const text = readText(path.join(projectDir, "STORYBOARD.md"));
    if (!text) throw new Error("STORYBOARD.md is required before it can be approved.");
    approvals.storyboard = { sha256: createHash("sha256").update(text).digest("hex") };
  } else if (target === "render") {
    const normalizedVersion = String(version ?? "").toLowerCase();
    if (!/^v\d{2}$/.test(normalizedVersion)) throw new Error("Render approval requires a version such as v07.");
    const renders = readRenders(projectDir);
    const renderPath = path.join(projectDir, "renders", `${path.basename(projectDir)}-${normalizedVersion}.mp4`);
    if (!renders.versions.includes(normalizedVersion) || !fs.existsSync(renderPath)) {
      throw new Error(`Numbered render ${normalizedVersion} is not present in VERSIONES.txt and on disk.`);
    }
    approvals.render = { version: normalizedVersion };
  } else {
    throw new Error("Approval target must be storyboard or render.");
  }
  meta.approvals = approvals;
  const temp = path.join(projectDir, `.meta.json.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
  fs.writeFileSync(temp, `${JSON.stringify(meta, null, 2)}\n`, { flag: "wx", mode: stat.mode & 0o777 });
  fs.renameSync(temp, metadataPath);
  return deriveProjectStatus(projectDir, studioRoot);
}
