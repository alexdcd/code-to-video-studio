import test from "node:test";
import assert from "node:assert/strict";
import {
  collectBlockers,
  assessSceneOpening,
  declaredAudioFromBrief,
  findMissingAssets,
  parseBriefAuthoring,
  parseBriefReference,
  parseStoryboardTiming,
  sceneRows,
  sceneSampleTimes,
  transitionSampleOffsets,
} from "../lib/review-core.mjs";

const clean = {
  checkExit: 0,
  missingAssets: [],
  renderDuration: 10,
  compositionDuration: 10,
  frameRate: 25,
  truePeakDbfs: -1.1,
  declaredAudio: true,
  hasAudio: true,
};

test("each required technical blocker is triggered", () => {
  const cases = [
    [{ checkExit: 1 }, "check-failed"],
    [{ missingAssets: ["assets/missing.svg"] }, "missing-asset"],
    [{ renderDuration: 10.05 }, "duration-mismatch"],
    [{ truePeakDbfs: -0.9 }, "true-peak"],
    [{ hasAudio: false }, "missing-audio"],
  ];
  for (const [change, expected] of cases) {
    assert.ok(collectBlockers({ ...clean, ...change }).some(blocker => blocker.id === expected), expected);
  }
});

test("unknown metadata stays unknown and does not create a migration blocker", () => {
  assert.deepEqual(collectBlockers({ ...clean, renderDuration: null, compositionDuration: null, frameRate: null, truePeakDbfs: null, hasAudio: null }), []);
  assert.deepEqual(collectBlockers({ ...clean, declaredAudio: false, hasAudio: false }), []);
  assert.deepEqual(collectBlockers({ ...clean, renderDuration: 10.04 }), []);
});

test("scene-opening edge signals produce review warnings only after 0.2 seconds", () => {
  assert.deepEqual(assessSceneOpening([]), { status: "unknown", emptyDurationSeconds: null, warning: false });

  const delayed = assessSceneOpening([
    { offsetSeconds: 0, edgeCoverage: 0.002 },
    { offsetSeconds: 0.1, edgeCoverage: 0.003 },
    { offsetSeconds: 0.2, edgeCoverage: 0.004 },
    { offsetSeconds: 0.3, edgeCoverage: 0.02 },
    { offsetSeconds: 0.4, edgeCoverage: 0.021 },
  ]);
  assert.equal(delayed.emptyDurationSeconds, 0.3);
  assert.equal(delayed.warning, true);

  const composed = assessSceneOpening([
    { offsetSeconds: 0, edgeCoverage: 0.018 },
    { offsetSeconds: 0.1, edgeCoverage: 0.019 },
    { offsetSeconds: 0.2, edgeCoverage: 0.02 },
  ]);
  assert.equal(composed.emptyDurationSeconds, 0);
  assert.equal(composed.warning, false);

  const thresholdEntry = assessSceneOpening([
    { offsetSeconds: 0, edgeCoverage: 0.001 },
    { offsetSeconds: 0.1, edgeCoverage: 0.002 },
    { offsetSeconds: 0.2, edgeCoverage: 0.02 },
    { offsetSeconds: 0.3, edgeCoverage: 0.021 },
    { offsetSeconds: 0.4, edgeCoverage: 0.022 },
  ]);
  assert.equal(thresholdEntry.emptyDurationSeconds, 0.2);
  assert.equal(thresholdEntry.warning, false);

  const lowDetail = assessSceneOpening([
    { offsetSeconds: 0, edgeCoverage: 0.001 },
    { offsetSeconds: 0.1, edgeCoverage: 0.002 },
    { offsetSeconds: 0.2, edgeCoverage: 0.003 },
    { offsetSeconds: 0.3, edgeCoverage: 0.004 },
    { offsetSeconds: 0.4, edgeCoverage: 0.003 },
    { offsetSeconds: 0.5, edgeCoverage: 0.002 },
  ]);
  assert.equal(lowDetail.status, "low-detail");
  assert.equal(lowDetail.warning, true);
});

test("transition strips sample six frames across the incoming cut", () => {
  assert.deepEqual(transitionSampleOffsets(0), [0, 0.1, 0.2, 0.3, 0.4, 0.5]);
  assert.deepEqual(transitionSampleOffsets(2.6), [-0.1, 0, 0.1, 0.2, 0.3, 0.5]);
});

test("check diagnostics identify unresolved media assets", () => {
  const report = { results: [{ code: "missing_asset", message: "Missing asset file", path: "assets/item.svg" }] };
  assert.deepEqual(findMissingAssets(report), ["assets/item.svg"]);
  assert.deepEqual(findMissingAssets({ runtime: [{ code: "console_warning", message: "GSAP target  not found.", sourceFile: "index.html" }] }), []);
  assert.deepEqual(findMissingAssets({ error: { message: "Asset does not exist", path: "assets/absent.svg" } }), ["assets/absent.svg"]);
});

test("reference frontmatter exposes only declared fidelity choices", () => {
  const brief = `---\nreference:\n  id: sample-reference\n  fidelity: essence\n  keep: [rhythm-arc]\n  transform:\n    narrative-spine: "music carries the story"\n  ignore: [signature-device]\n---\n`;
  assert.deepEqual(parseBriefReference(brief), {
    status: "configured",
    id: "sample-reference",
    fidelity: "essence",
    keep: ["rhythm-arc"],
    transform: { "narrative-spine": "music carries the story" },
    ignore: ["signature-device"],
  });
});

test("authoring mode defaults to unknown for legacy briefs", () => {
  assert.equal(parseBriefAuthoring("# Legacy brief without frontmatter"), "unknown");
  assert.equal(parseBriefAuthoring("---\nstyle: starter\n---\n"), "unknown");
  assert.equal(parseBriefAuthoring("---\nauthoring: bespoke\n---\n"), "bespoke");
  assert.equal(parseBriefAuthoring("---\nauthoring: template\n---\n"), "template");
});

test("storyboard time intervals form a lower-bound duration", () => {
  const storyboard = `| # | Tiempo | Escena |\n|---|---|---|\n| 01 | 0–10 | one |\n| 02 | 10–14 | two |\n`;
  assert.equal(parseStoryboardTiming(storyboard).durationSeconds, 14);
  assert.equal(parseStoryboardTiming(storyboard).rows, 2);
});

test("explicit storyboard prologue and timing offsets are included", () => {
  const storyboard = `# STORYBOARD (14 s)\n\n> 14 s prologue; all other scenes add 4 s.\n\n| # | Tiempo | Scene |\n|---|---|---|\n| 01 | 0–10 | one |\n| 02 | 10–14 | two |\n`;
  const timing = parseStoryboardTiming(storyboard);
  assert.equal(timing.durationSeconds, 18);
  assert.equal(timing.declaredDurationSeconds, 14);
  assert.deepEqual(timing.intervals.map(item => [item.startSeconds, item.endSeconds]), [[0, 14], [14, 18]]);
});

test("audio declarations distinguish an explicit silent voice from declared music", () => {
  assert.equal(declaredAudioFromBrief("**Voz:** sin voz en off\n**Música y sonido:** una sola pieza"), true);
  assert.equal(declaredAudioFromBrief("**Voz:** sin voz en off"), false);
  assert.equal(declaredAudioFromBrief("---\nvoice: none\nmusic: score\n---"), true);
});

test("scene sample times cover the opening and the full-content moment of every scene", () => {
  const timeline = { timeline: { tracks: [
    { kind: "graphics", rows: [
      { id: "s02", absStart: 4, absEnd: 10 },
      { id: "s01", absStart: 0, absEnd: 4 },
      { id: "nested", absStart: 1, absEnd: 2, nested: true },
      { id: "s01", absStart: 0, absEnd: 4 },
    ] },
    { kind: "audio", rows: [{ id: "voz", absStart: 0, absEnd: 10 }] },
  ] } };
  const rows = sceneRows(timeline);
  assert.deepEqual(rows.map(row => row.id), ["s01", "s02"]);
  assert.deepEqual(sceneSampleTimes(rows), [
    { id: "s01", startSeconds: 0, endSeconds: 4, openingSeconds: 0.25, midpointSeconds: 2, fullSeconds: 3.5 },
    { id: "s02", startSeconds: 4, endSeconds: 10, openingSeconds: 4.25, midpointSeconds: 7, fullSeconds: 9.5 },
  ]);
  const [short] = sceneSampleTimes([{ id: "flash", start: 0, end: 1 }]);
  assert.equal(short.openingSeconds, 0.1);
  assert.equal(short.fullSeconds, 0.85);
});
