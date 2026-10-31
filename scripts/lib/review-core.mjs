export function collectBlockers({
  checkExit = 0,
  missingAssets = [],
  renderDuration = null,
  compositionDuration = null,
  frameRate = null,
  truePeakDbfs = null,
  declaredAudio = false,
  hasAudio = null,
}) {
  const blockers = [];
  if (checkExit !== 0) {
    blockers.push({ id: "check-failed", message: "HyperFrames check failed." });
  }
  for (const asset of missingAssets) {
    blockers.push({ id: "missing-asset", message: `Missing asset: ${asset}` });
  }
  if (Number.isFinite(renderDuration) && Number.isFinite(compositionDuration) && Number.isFinite(frameRate) && frameRate > 0) {
    const difference = Math.abs(renderDuration - compositionDuration);
    if (difference > 1 / frameRate + 1e-9) {
      blockers.push({
        id: "duration-mismatch",
        message: `Render duration differs from the composition by ${difference.toFixed(3)} s (more than one frame).`,
      });
    }
  }
  if (Number.isFinite(truePeakDbfs) && truePeakDbfs > -1) {
    blockers.push({
      id: "true-peak",
      message: `True peak is ${truePeakDbfs} dBFS; the maximum is -1.0 dBFS.`,
    });
  }
  if (declaredAudio && hasAudio === false) {
    blockers.push({ id: "missing-audio", message: "The brief declares voice or music, but the render has no audio." });
  }
  return blockers;
}

export function assessSceneOpening(samples, { minimumCoverage = 0.012, sustainedRatio = 0.65, warningAfterSeconds = 0.2 } = {}) {
  const ordered = [...samples]
    .filter(sample => Number.isFinite(sample?.offsetSeconds) && Number.isFinite(sample?.edgeCoverage))
    .sort((a, b) => a.offsetSeconds - b.offsetSeconds);
  if (ordered.length < 2) return { status: "unknown", emptyDurationSeconds: null, warning: false };

  const peakCoverage = Math.max(...ordered.map(sample => sample.edgeCoverage));
  const threshold = Math.max(minimumCoverage, peakCoverage * sustainedRatio);
  let onsetIndex = -1;
  for (let index = 0; index < ordered.length - 1; index++) {
    if (ordered[index].edgeCoverage >= threshold && ordered[index + 1].edgeCoverage >= threshold) {
      onsetIndex = index;
      break;
    }
  }
  if (onsetIndex < 0) {
    onsetIndex = ordered.findIndex(sample => sample.edgeCoverage >= threshold);
  }

  const emptyDurationSeconds = onsetIndex < 0
    ? ordered.at(-1).offsetSeconds
    : ordered[onsetIndex].offsetSeconds;
  return {
    status: peakCoverage < minimumCoverage ? "low-detail" : "measured",
    peakCoverage: Number(peakCoverage.toFixed(5)),
    thresholdCoverage: Number(threshold.toFixed(5)),
    emptyDurationSeconds: Number(emptyDurationSeconds.toFixed(3)),
    warning: emptyDurationSeconds > warningAfterSeconds + 1e-9,
  };
}

export function transitionSampleOffsets(cutSeconds) {
  return cutSeconds <= 0.001
    ? [0, 0.1, 0.2, 0.3, 0.4, 0.5]
    : [-0.1, 0, 0.1, 0.2, 0.3, 0.5];
}

export function sceneRows(timeline) {
  const rows = timeline?.timeline?.tracks
    ?.filter(track => track.kind === "graphics")
    .flatMap(track => track.rows ?? [])
    .filter(row => Number.isFinite(row.absStart ?? row.start) && Number.isFinite(row.absEnd ?? row.end)
      && (row.absEnd ?? row.end) > (row.absStart ?? row.start) && !row.nested) ?? [];
  const unique = new Map();
  for (const row of rows) {
    const key = `${row.file ?? ""}:${row.id}:${row.absStart ?? row.start}`;
    if (!unique.has(key)) unique.set(key, row);
  }
  return [...unique.values()].sort((a, b) => (a.absStart ?? a.start) - (b.absStart ?? b.start));
}

// Review instants per scene: "opening" catches empty starts, "full" is the moment the scene's content
// should be completely on screen (before its exit), where clipped text and broken layouts show up.
export function sceneSampleTimes(rows) {
  const round = value => Number(value.toFixed(3));
  return rows.map((row, index) => {
    const start = row.absStart ?? row.start;
    const end = row.absEnd ?? row.end;
    const duration = end - start;
    return {
      id: String(row.id ?? `scene-${index + 1}`),
      startSeconds: round(start),
      endSeconds: round(end),
      openingSeconds: round(start + Math.min(0.25, duration * 0.1)),
      midpointSeconds: round((start + end) / 2),
      fullSeconds: round(end - Math.min(0.5, duration * 0.15)),
    };
  });
}

export function findMissingAssets(value) {
  const found = new Set();
  const visit = item => {
    if (Array.isArray(item)) {
      for (const child of item) visit(child);
      return;
    }
    if (!item || typeof item !== "object") return;
    const code = String(item.code ?? item.type ?? item.kind ?? "");
    const message = [item.message, item.detail, item.reason]
      .filter(entry => typeof entry === "string")
      .join(" ");
    const codeSignalsMissing = /(?:missing|unresolved)[_-]?(?:asset|file|media|source)|(?:asset|file|media|source)[_-]?(?:missing|not[_-]?found)/i.test(code);
    const messageSignalsMissing = /\b(?:missing|unresolved)\s+(?:asset|file|media|source)\b|\b(?:asset|file|media|source)\s+(?:not found|does not exist|could not be found)\b/i.test(message);
    if (codeSignalsMissing || messageSignalsMissing) {
      const candidate = item.path ?? item.asset ?? item.file ?? item.src ?? item.message ?? item.detail;
      found.add(typeof candidate === "string" ? candidate : message || code);
    }
    for (const child of Object.values(item)) visit(child);
  };
  visit(value);
  return [...found].sort();
}

export function parseBriefReference(brief) {
  const frontmatter = brief.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!frontmatter) return { status: "unknown", id: null, fidelity: null, keep: [], transform: {}, ignore: [] };
  const lines = frontmatter[1].split(/\r?\n/);
  const referenceStart = lines.findIndex(line => /^reference\s*:\s*$/.test(line));
  if (referenceStart < 0) return { status: "none", id: null, fidelity: null, keep: [], transform: {}, ignore: [] };
  const block = [];
  for (let index = referenceStart + 1; index < lines.length; index++) {
    const line = lines[index];
    if (/^[A-Za-z][\w-]*\s*:/.test(line) && !/^\s/.test(line)) break;
    block.push(line);
  }
  const text = block.join("\n");
  const scalar = key => text.match(new RegExp(`^\\s+${key}\\s*:\\s*([^#\\n]+)`, "m"))?.[1]?.trim() ?? null;
  const list = key => {
    const value = scalar(key) ?? "";
    return [...value.matchAll(/[A-Za-z][A-Za-z0-9-]*/g)].map(match => match[0]);
  };
  const transform = {};
  const transformStart = block.findIndex(line => /^\s+transform\s*:\s*$/.test(line));
  if (transformStart >= 0) {
    for (let index = transformStart + 1; index < block.length; index++) {
      const line = block[index];
      if (!/^\s{4,}[\w-]+\s*:/.test(line)) break;
      const match = line.match(/^\s{4,}([\w-]+)\s*:\s*(.*)$/);
      if (match) transform[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
  const id = scalar("id")?.replace(/^['"]|['"]$/g, "") ?? null;
  return {
    status: id ? "configured" : "unknown",
    id,
    fidelity: scalar("fidelity")?.replace(/^['"]|['"]$/g, "") ?? null,
    keep: list("keep"),
    transform,
    ignore: list("ignore"),
  };
}

export function parseBriefAuthoring(brief) {
  const frontmatter = brief.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/)?.[1] ?? "";
  const value = frontmatter.match(/^authoring\s*:\s*([^#\n]+)\s*$/mi)?.[1]?.trim().replace(/^['"]|['"]$/g, "").toLowerCase();
  return value === "bespoke" || value === "template" ? value : "unknown";
}

export function parseStoryboardTiming(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex(line => /^\|.*(?:Tiempo|Time).*\|/i.test(line));
  if (headerIndex < 0) return { status: "unknown", rows: 0, durationSeconds: null, intervals: [] };
  const headers = lines[headerIndex].split("|").slice(1, -1).map(cell => cell.trim().toLowerCase());
  const timeIndex = headers.findIndex(cell => /^(tiempo|time)$/.test(cell));
  if (timeIndex < 0) return { status: "unknown", rows: 0, durationSeconds: null, intervals: [] };
  const intervals = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.startsWith("|")) break;
    if (/^\|\s*:?-+/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map(cell => cell.trim());
    const value = cells[timeIndex] ?? "";
    const range = value.match(/(-?\d+(?:[.,]\d+)?)\s*(?:–|—|−|\bto\b|-)\s*(-?\d+(?:[.,]\d+)?)/i);
    if (!range) continue;
    const start = Number(range[1].replace(",", "."));
    const end = Number(range[2].replace(",", "."));
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      intervals.push({ startSeconds: start, endSeconds: end, label: cells[0] ?? "" });
    }
  }
  if (intervals.length === 0) return { status: "unknown", rows: 0, durationSeconds: null, declaredDurationSeconds: null, intervals: [] };
  const declaredMatch = markdown.match(/^#.*?\(\s*(\d+(?:[.,]\d+)?)\s*s\s*\)/mi);
  const declaredDurationSeconds = declaredMatch ? Number(declaredMatch[1].replace(",", ".")) : null;
  const prologueMatch = markdown.match(/(?:pr[oó]logo de\s+(\d+(?:[.,]\d+)?)\s*s|(\d+(?:[.,]\d+)?)\s*s\s+prologue)/i);
  const offsetMatch = markdown.match(/(?:sumar\s+(\d+(?:[.,]\d+)?)\s+s\s+a\s+los\s+tiempos\s+de\s+las\s+escenas|all\s+other\s+scenes\s+add\s+(\d+(?:[.,]\d+)?)\s+s)/i);
  if (prologueMatch && intervals.length > 0 && /^0*1\b/.test(intervals[0].label)) {
    const prologueDuration = Number((prologueMatch[1] ?? prologueMatch[2]).replace(",", "."));
    intervals[0].endSeconds = intervals[0].startSeconds + prologueDuration;
  }
  if (offsetMatch) {
    const offset = Number((offsetMatch[1] ?? offsetMatch[2]).replace(",", "."));
    for (const interval of intervals.slice(1)) {
      interval.startSeconds += offset;
      interval.endSeconds += offset;
    }
  }
  const startsAtZero = Math.min(...intervals.map(item => item.startSeconds)) === 0;
  const nonOverlapping = [...intervals].sort((a, b) => a.startSeconds - b.startSeconds);
  const durationSeconds = startsAtZero
    ? Math.max(...intervals.map(item => item.endSeconds))
    : nonOverlapping.reduce((sum, item) => sum + item.endSeconds - item.startSeconds, 0);
  return { status: "measured", rows: intervals.length, durationSeconds, declaredDurationSeconds, intervals };
}

export function declaredAudioFromBrief(brief) {
  const frontmatter = brief.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/)?.[1] ?? "";
  let sawAudioField = false;
  for (const line of frontmatter.split(/\r?\n/)) {
    const match = line.match(/^\s*(voice|music|audio)\s*:\s*(.+)$/i);
    if (!match) continue;
    sawAudioField = true;
    if (!/^(none|no|false|unknown|n\/a)\s*$/i.test(match[2].trim())) return true;
  }
  if (sawAudioField) return false;
  const fields = brief.split(/\r?\n/).map(line => line.replace(/\*\*/g, "").trim())
    .map(line => line.match(/^(voz|voice|m[uú]sica(?:\s+y\s+sonido)?|music|audio)\s*:\s*(.+)$/i))
    .filter(Boolean);
  for (const [, label, value] of fields) {
    const text = value.toLowerCase();
    if (/^(none|no|false|n\/a|ninguna?|sin\s+(?:voz|m[uú]sica|audio))\b/.test(text)) continue;
    if (/^(voz|voice)$/.test(label.toLowerCase()) && /\b(?:sin\s+voz|no\s+voice|no\s+off|none)\b/.test(text)) continue;
    return true;
  }
  return false;
}

// Lee la columna «Subtítulo»/«Subtitle» del STORYBOARD (sí/no · motivo) y devuelve los tramos sin subtítulo
// (para `ocultar` en MAFIA.subs) y el aviso que corresponda a la norma «subtítulos solo cuando aportan».
export function parseStoryboardSubtitles(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex(line => /^\|.*(?:Tiempo|Time).*\|/i.test(line));
  const empty = { status: "missing", rows: 0, withSubtitles: 0, withoutSubtitles: 0, hideRanges: [], warning: null };
  if (headerIndex < 0) return empty;
  const headers = lines[headerIndex].split("|").slice(1, -1).map(cell => cell.trim().toLowerCase());
  const timeIndex = headers.findIndex(cell => /^(tiempo|time)$/.test(cell));
  const subIndex = headers.findIndex(cell => /^(subt[ií]tulos?|subtitles?|captions?)\b/.test(cell));
  if (subIndex < 0) {
    return { ...empty, warning: "El STORYBOARD no tiene columna «Subtítulo» (sí/no · motivo): decide dónde se omiten los subtítulos." };
  }
  const hideRanges = [];
  let withSubtitles = 0;
  let withoutSubtitles = 0;
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.startsWith("|")) break;
    if (/^\|\s*:?-+/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map(cell => cell.trim());
    const verdict = (cells[subIndex] ?? "").toLowerCase();
    const range = (cells[timeIndex] ?? "").match(/(-?\d+(?:[.,]\d+)?)\s*(?:–|—|−|\bto\b|-)\s*(-?\d+(?:[.,]\d+)?)/i);
    if (/^(no|off|sin)(?![\p{L}])/u.test(verdict)) {
      withoutSubtitles += 1;
      if (range) hideRanges.push([Number(range[1].replace(",", ".")), Number(range[2].replace(",", "."))]);
    } else if (/^(s[ií]|yes|on)(?![\p{L}])/u.test(verdict)) {
      withSubtitles += 1;
    }
  }
  const rows = withSubtitles + withoutSubtitles;
  let warning = null;
  if (rows > 2 && withoutSubtitles === 0) {
    warning = "Todas las escenas llevan subtítulo. Revisa dónde un texto o imagen ya dice lo mismo que la voz y apágalos ahí.";
  }
  return { status: "measured", rows, withSubtitles, withoutSubtitles, hideRanges, warning };
}
