import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createVariant, parseArgs, variantOwner } from "../variant.mjs";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ctv-variant-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const studio = path.join(root, "studio");
  const projects = path.join(root, "projects");
  const source = path.join(projects, "video");
  fs.mkdirSync(path.join(studio, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(source, "assets/audio"), { recursive: true });
  fs.mkdirSync(path.join(source, "compositions"), { recursive: true });
  fs.mkdirSync(path.join(source, "renders"), { recursive: true });
  fs.mkdirSync(path.join(source, "node_modules"), { recursive: true });
  fs.mkdirSync(path.join(source, "assets/.cache"), { recursive: true });
  fs.writeFileSync(path.join(source, "index.html"), "<html>source</html>");
  fs.writeFileSync(path.join(source, "BRIEF.md"), "# BRIEF\n\nBrief content.\n");
  fs.writeFileSync(path.join(source, "SCRIPT.md"), "Source script\n");
  fs.writeFileSync(path.join(source, "STORYBOARD.md"), "Storyboard\n");
  fs.writeFileSync(path.join(source, "assets/audio/voice.ogg"), "audio");
  fs.writeFileSync(path.join(source, "assets/.cache/item.json"), "cache");
  fs.writeFileSync(path.join(source, ".env"), "TOKEN=private\n");
  fs.writeFileSync(path.join(source, ".npmrc"), "//registry.example/:_authToken=private\n");
  fs.writeFileSync(path.join(source, "credentials.json"), "{\"token\":\"private\"}\n");
  fs.mkdirSync(path.join(source, "models"), { recursive: true });
  fs.writeFileSync(path.join(source, "models/model.gguf"), "weights");
  fs.writeFileSync(path.join(source, "node_modules/dependency.js"), "cache");
  fs.writeFileSync(path.join(source, "renders/VERSIONES.txt"), "v04 · 2026-01-02 · reviewed\n");
  fs.writeFileSync(path.join(source, "renders/video-v04.mp4"), "render");
  fs.writeFileSync(path.join(source, "meta.json"), JSON.stringify({
    id: "video", name: "video", created: "2026-01-02", approvals: { storyboard: { sha256: "old" } },
  }));
  return { studio, projects, source };
}

test("variant copies production inputs, excludes renders/caches/secrets, and records lineage", t => {
  const { studio, projects, source } = fixture(t);
  const output = createVariant({ source: "video", id: "en", language: "en-US", studioRoot: studio, projectsRoot: projects });
  assert.equal(output, path.join(fs.realpathSync(projects), "video--en"));
  assert.equal(fs.existsSync(path.join(output, "assets/audio/voice.ogg")), true);
  assert.equal(fs.existsSync(path.join(output, "renders")), false);
  assert.equal(fs.existsSync(path.join(output, "node_modules")), false);
  assert.equal(fs.existsSync(path.join(output, "assets/.cache")), false);
  assert.equal(fs.existsSync(path.join(output, ".env")), false);
  assert.equal(fs.existsSync(path.join(output, ".npmrc")), false);
  assert.equal(fs.existsSync(path.join(output, "credentials.json")), false);
  assert.equal(fs.existsSync(path.join(output, "models")), false);
  assert.match(fs.readFileSync(path.join(output, "BRIEF.md"), "utf8"), /^---\nnarration_language: en-US\n---/);
  assert.match(fs.readFileSync(path.join(output, "BRIEF.md"), "utf8"), /Brief content\./);

  const meta = JSON.parse(fs.readFileSync(path.join(output, "meta.json"), "utf8"));
  assert.equal(meta.parent_project, "video");
  assert.equal(meta.variant, "en");
  assert.equal(meta.source_project, "video");
  assert.equal(meta.source_render, "v04");
  assert.equal(meta.origin_render, "v04");
  assert.equal(meta.origin_created, "2026-01-02");
  assert.equal(meta.approvals, undefined);
  assert.equal(meta.source_approved_render, undefined);
  assert.equal(variantOwner(output, projects), path.join(fs.realpathSync(projects), "video"));
  assert.equal(fs.existsSync(path.join(source, "meta.json")), true);
});

test("variants of variants stay flat siblings and preserve original provenance", t => {
  const { studio, projects } = fixture(t);
  const first = createVariant({ source: "video", id: "en", studioRoot: studio, projectsRoot: projects });
  const second = createVariant({ source: "video--en", id: "short", studioRoot: studio, projectsRoot: projects });
  assert.equal(second, path.join(fs.realpathSync(projects), "video--short"));
  assert.equal(fs.existsSync(path.join(fs.realpathSync(projects), "video--en--short")), false);
  const meta = JSON.parse(fs.readFileSync(path.join(second, "meta.json"), "utf8"));
  assert.equal(meta.parent_project, "video");
  assert.equal(meta.source_project, "video--en");
  assert.equal(meta.source_render, null);
  assert.equal(meta.origin_render, "v04");
  assert.equal(variantOwner(first, projects), path.join(fs.realpathSync(projects), "video"));
});

test("refuses existing destinations and retained symlinks without changing the source", t => {
  const { studio, projects, source } = fixture(t);
  const output = createVariant({ source: "video", id: "en", studioRoot: studio, projectsRoot: projects });
  assert.throws(() => createVariant({ source: "video", id: "en", studioRoot: studio, projectsRoot: projects }), /already exists/);
  fs.symlinkSync("voice.ogg", path.join(source, "assets/audio/link.ogg"));
  assert.throws(() => createVariant({ source: "video", id: "fr", studioRoot: studio, projectsRoot: projects }), /Symbolic links/);
  assert.equal(fs.existsSync(path.join(projects, "video--fr")), false);
  assert.equal(fs.existsSync(path.join(output, "index.html")), true);
  assert.equal(fs.existsSync(path.join(source, "index.html")), true);
});

test("CLI parser accepts language flags and rejects invalid IDs", () => {
  assert.deepEqual(parseArgs(["--", "video", "en", "--language", "en-US"]), { source: "video", id: "en", language: "en-US" });
  assert.throws(() => parseArgs(["video", "invalid--id"]), /lowercase letters/);
  assert.throws(() => parseArgs(["video", "en", "--language", "bad tag"]), /Unsupported language/);
});
