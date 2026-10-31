import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { approveProject, deriveProjectStatus } from "../lib/project-status.mjs";

function write(root, relative, value) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
  return file;
}

function createStudio(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "production-status-"));
  const projectDir = path.join(root, "demo");
  fs.mkdirSync(projectDir);
  write(root, "kit/styles/starter/ficha.json", JSON.stringify({ id: "starter", status: "development" }));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, projectDir };
}

function createRenderedProject(t) {
  const fixture = createStudio(t);
  const { root, projectDir } = fixture;
  write(projectDir, "BRIEF.md", [
    "---",
    "authoring: template",
    "style: starter",
    "reference:",
    "  id: sample",
    "  fidelity: essence",
    "  keep: [rhythm-arc]",
    "---",
    "",
    "# Brief",
    "A complete description of this video.",
    "",
  ].join("\n"));
  write(projectDir, "SCRIPT.md", [
    "# Script",
    "",
    "| # | Text | Notes |",
    "| --- | --- | --- |",
    "| 1 | Begin | First reading |",
    "",
  ].join("\n"));
  write(projectDir, "STORYBOARD.md", [
    "| # | File | Time | Event | Status |",
    "| --- | --- | --- | --- | --- |",
    "| 01 | s01 | 0–2 | Establish the subject | built |",
    "| 02 | s02 | 2–4 | Change the subject | built |",
    "",
  ].join("\n"));
  write(projectDir, "index.html", '<audio id="music" src="assets/audio/music.ogg"></audio>');
  write(projectDir, "assets/audio/music.ogg", "fixture");
  write(projectDir, "compositions/s01.html", "<template></template>");
  write(projectDir, "compositions/s02.html", "<template></template>");
  write(projectDir, "meta.json", JSON.stringify({ id: "demo", name: "demo" }, null, 2));
  write(projectDir, "renders/check.json", JSON.stringify({ ok: true }));
  write(projectDir, "renders/VERSIONES.txt", "v01 · 2026-01-01 · test render\n");
  write(projectDir, "renders/demo-v01.mp4", "synthetic render placeholder");
  const base = Date.parse("2026-01-01T00:00:00Z") / 1000;
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (!file.includes(path.sep + "renders" + path.sep)) fs.utimesSync(file, base, base);
    }
  };
  visit(projectDir);
  fs.utimesSync(path.join(projectDir, "renders/check.json"), base + 100, base + 100);
  return fixture;
}

test("empty projects return a useful status and keep absent fields unknown", t => {
  const { root, projectDir } = createStudio(t);
  const status = deriveProjectStatus(projectDir, root);
  assert.equal(status.schemaVersion, 1);
  assert.equal(status.areas.brief.status, "unknown");
  assert.equal(status.areas.brief.authoring, "unknown");
  assert.equal(status.areas.style.status, "unknown");
  assert.equal(status.areas.check.status, "unknown");
  assert.equal(status.areas.audio.status, "unknown");
  assert.equal(status.areas.approvals.storyboard.status, "unknown");
  assert.equal(status.nextStep.id, "complete-brief");
});

test("unfilled brief and script templates are reported as incomplete", t => {
  const { root, projectDir } = createStudio(t);
  write(projectDir, "BRIEF.md", "---\nauthoring: bespoke\n---\n\n# Brief\n- **Subject:**\n- **Format:** (template)\n");
  write(projectDir, "SCRIPT.md", "# Script\n\n| # | Text | Notes |\n| --- | --- | --- |\n| 1 |  |  |\n");
  const status = deriveProjectStatus(projectDir, root);
  assert.equal(status.areas.brief.status, "incomplete");
  assert.equal(status.areas.script.status, "template");
});

test("in-progress projects retain outline rows until compositions exist", t => {
  const { root, projectDir } = createStudio(t);
  write(projectDir, "BRIEF.md", "---\nauthoring: bespoke\n---\n\n# Brief\nA clear subject and audience.\n");
  write(projectDir, "SCRIPT.md", "# Script\n\nOpening phrase.\n");
  write(projectDir, "STORYBOARD.md", [
    "| # | File | Time | Event |",
    "| --- | --- | --- | --- |",
    "| 01 | s01 | 0–3 | Establish the subject |",
    "",
  ].join("\n"));
  const status = deriveProjectStatus(projectDir, root);
  assert.equal(status.areas.brief.status, "complete");
  assert.equal(status.areas.storyboard.status, "outline");
  assert.equal(status.areas.storyboard.rows.outline, 1);
  assert.equal(status.areas.storyboard.rows.missingComposition, 1);
  assert.equal(status.nextStep.id, "complete-storyboard");
});

test("rendered projects derive style, storyboard, audio, check, and render state", t => {
  const { root, projectDir } = createRenderedProject(t);
  const status = deriveProjectStatus(projectDir, root);
  assert.equal(status.areas.brief.authoring, "template");
  assert.deepEqual(status.areas.brief.reference.keep, ["rhythm-arc"]);
  assert.deepEqual(status.areas.style, { status: "named", id: "starter", state: "development" });
  assert.equal(status.areas.script.status, "authored");
  assert.equal(status.areas.storyboard.status, "built");
  assert.equal(status.areas.storyboard.rows.total, 2);
  assert.equal(status.areas.audio.status, "declared");
  assert.equal(status.areas.check.status, "passed");
  assert.equal(status.areas.renders.latestVersion, "v01");
  assert.equal(status.areas.review.status, "unknown");
  assert.equal(status.nextStep.id, "review");
});

test("an explicit no-audio declaration stays distinct from missing audio metadata", t => {
  const { root, projectDir } = createStudio(t);
  write(projectDir, "BRIEF.md", "# Brief\n**Voice:** No voice-over.\n");
  assert.equal(deriveProjectStatus(projectDir, root).areas.audio.status, "unknown");
  write(projectDir, "BRIEF.md", "# Brief\n**Voice:** None\n**Music and sound:** None\n");
  assert.equal(deriveProjectStatus(projectDir, root).areas.audio.status, "silent");
});

test("review status recognizes decisions and flags older renders or checks", t => {
  const { root, projectDir } = createRenderedProject(t);
  const review = write(projectDir, "renders/demo-v01-review/REVIEW.md", [
    "# Review",
    "",
    "Decision: **PASS WITH WARNINGS**",
    "",
    "Render: \x60renders/demo-v01.mp4\x60",
    "",
    "| **BLOCKER** | missing file |",
    "| WARNING | hold is intentional |",
    "",
  ].join("\n"));
  let status = deriveProjectStatus(projectDir, root);
  assert.equal(status.areas.review.decision, "PASS WITH WARNINGS");
  assert.equal(status.areas.review.stale, false);
  assert.deepEqual(status.areas.review.findings, { blockers: 1, warnings: 1, info: 0 });

  write(projectDir, "renders/VERSIONES.txt", "v01 · 2026-01-01 · first\nv02 · 2026-01-02 · second\n");
  write(projectDir, "renders/demo-v02.mp4", "synthetic render placeholder");
  fs.utimesSync(path.join(projectDir, "STORYBOARD.md"), 1_767_225_800, 1_767_225_800);
  fs.utimesSync(review, 1_767_225_801, 1_767_225_801);
  status = deriveProjectStatus(projectDir, root);
  assert.equal(status.areas.check.status, "stale");
  assert.equal(status.areas.review.status, "stale");
  assert.ok(status.stale.includes("check"));
  assert.ok(status.stale.includes("review"));
});

test("approvals are versioned metadata and become stale when their source changes", t => {
  const { root, projectDir } = createRenderedProject(t);
  let status = approveProject({ projectDir, studioRoot: root, target: "storyboard" });
  assert.equal(status.areas.approvals.storyboard.status, "approved");
  status = approveProject({ projectDir, studioRoot: root, target: "render", version: "v01" });
  assert.equal(status.areas.approvals.render.status, "approved");

  write(projectDir, "STORYBOARD.md", "# Updated storyboard\n");
  status = deriveProjectStatus(projectDir, root);
  assert.equal(status.areas.approvals.storyboard.status, "stale");
  write(projectDir, "renders/VERSIONES.txt", "v01 · 2026-01-01 · first\nv02 · 2026-01-02 · second\n");
  write(projectDir, "renders/demo-v02.mp4", "synthetic render placeholder");
  status = deriveProjectStatus(projectDir, root);
  assert.equal(status.areas.approvals.render.status, "stale");
});
