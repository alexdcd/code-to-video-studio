import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createVariant, parseArgs } from "../variant.mjs";

function write(root, rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

function fixture() {
  const studioRoot = fs.mkdtempSync(path.join(os.tmpdir(), "code-to-video-variant-"));
  const source = path.join(studioRoot, "proyectos", "alpha");
  fs.mkdirSync(source, { recursive: true });
  write(source, "BRIEF.md", "---\nnarration_language: es-ES\n---\nOriginal brief.\n");
  write(source, "SCRIPT.md", "Original script.\n");
  write(source, "STORYBOARD.md", "Original storyboard.\n");
  write(source, "index.html", "<!doctype html><title>alpha</title>\n");
  write(source, "compositions/scene.html", "Original scene.\n");
  write(source, "assets/kit/helper.js", "export const reusable = true;\n");
  write(source, "meta.json", JSON.stringify({ name: "alpha", template: "starter-9x16", kit: "0.1.0", created: "2026-09-01" }));
  write(source, ".env", "TOKEN=do-not-copy\n");
  write(source, "config/api-token.json", "{\"token\":\"do-not-copy\"}\n");
  write(source, "config/private-key.pem", "private key\n");
  write(source, "renders/VERSIONES.txt", "v01 · 2026-09-02 · first\nv02 · 2026-09-03 · approved\n");
  write(source, "renders/alpha-v01.mp4", "old video");
  write(source, "renders/alpha-v02.mp4", "approved video");
  write(source, "renders/alpha-v02-redes.mp4", "social video");
  write(source, ".hyperframes/cache.json", "{}");
  write(source, "node_modules/example/index.js", "installed dependency");
  write(source, "models/local.safetensors", "model weights");
  return { studioRoot, source, cleanup: () => fs.rmSync(studioRoot, { recursive: true, force: true }) };
}

test("variant copies editable project files, excludes outputs and secrets, and records provenance", (t) => {
  const { studioRoot, source } = fixture();
  t.after(() => fs.rmSync(studioRoot, { recursive: true, force: true }));
  const before = fs.readFileSync(path.join(source, "meta.json"), "utf8");

  const target = createVariant({ source: "alpha", id: "instagram", studioRoot });

  assert.equal(path.basename(target), "alpha--instagram");
  assert.equal(fs.readFileSync(path.join(target, "index.html"), "utf8"), fs.readFileSync(path.join(source, "index.html"), "utf8"));
  assert.equal(fs.readFileSync(path.join(target, "assets/kit/helper.js"), "utf8"), "export const reusable = true;\n");
  for (const excluded of ["renders", ".hyperframes", "node_modules", "models", ".env", "config/api-token.json", "config/private-key.pem"]) {
    assert.equal(fs.existsSync(path.join(target, excluded)), false, `${excluded} should not be copied`);
  }

  const meta = JSON.parse(fs.readFileSync(path.join(target, "meta.json"), "utf8"));
  assert.equal(meta.origin_project, "alpha");
  assert.equal(meta.origin_created, "2026-09-01");
  assert.equal(meta.origin_render, "v02");
  assert.equal(meta.source_project, "alpha");
  assert.equal(meta.source_render, "v02");
  assert.equal(meta.parent_project, "alpha");
  assert.equal(meta.variant, "instagram");
  assert.equal(fs.readFileSync(path.join(source, "meta.json"), "utf8"), before, "source metadata must remain unchanged");

  fs.writeFileSync(path.join(target, "SCRIPT.md"), "Variant only.\n");
  assert.equal(fs.readFileSync(path.join(source, "SCRIPT.md"), "utf8"), "Original script.\n");
});

test("a variant of a variant keeps original provenance and uses its immediate source", (t) => {
  const { studioRoot } = fixture();
  t.after(() => fs.rmSync(studioRoot, { recursive: true, force: true }));
  const first = createVariant({ source: "alpha", id: "instagram", studioRoot });
  const second = createVariant({ source: path.relative(studioRoot, first), id: "english", language: "en-GB", studioRoot });
  const meta = JSON.parse(fs.readFileSync(path.join(second, "meta.json"), "utf8"));

  assert.equal(meta.origin_project, "alpha");
  assert.equal(meta.origin_created, "2026-09-01");
  assert.equal(meta.origin_render, "v02");
  assert.equal(meta.source_project, "alpha--instagram");
  assert.equal(meta.source_render, null, "historical renders are not copied into a variant");
  assert.equal(meta.variant, "english");
  assert.match(fs.readFileSync(path.join(second, "BRIEF.md"), "utf8"), /narration_language: en-GB/);
  assert.equal(fs.existsSync(path.join(second, "renders")), false);
});

test("variant creation never overwrites a sibling and rejects project paths outside proyectos/", (t) => {
  const { studioRoot } = fixture();
  t.after(() => fs.rmSync(studioRoot, { recursive: true, force: true }));
  const target = createVariant({ source: "alpha", id: "instagram", studioRoot });
  const before = fs.readFileSync(path.join(target, "SCRIPT.md"), "utf8");

  assert.throws(() => createVariant({ source: "alpha", id: "instagram", studioRoot }), /already exists/);
  assert.throws(() => createVariant({ source: os.tmpdir(), id: "outside", studioRoot }), /direct child of proyectos/);
  assert.equal(fs.readFileSync(path.join(target, "SCRIPT.md"), "utf8"), before);
});

test("variant CLI parses a language once and rejects invalid ids", () => {
  assert.deepEqual(parseArgs(["alpha", "short-en", "--language", "en-US"]), {
    source: "alpha", id: "short-en", language: "en-US",
  });
  assert.throws(() => parseArgs(["alpha", "Short"]), /id/);
  assert.throws(() => parseArgs(["alpha", "short", "--language", "english"]), /Unsupported language/);
});

test("setting a language adds frontmatter to a starter brief without overwriting its contents", (t) => {
  const { studioRoot, source } = fixture();
  t.after(() => fs.rmSync(studioRoot, { recursive: true, force: true }));
  const brief = path.join(source, "BRIEF.md");
  fs.writeFileSync(brief, "# BRIEF · alpha\n\nOriginal content.\n");

  const target = createVariant({ source: "alpha", id: "english", language: "en-GB", studioRoot });

  assert.equal(fs.readFileSync(brief, "utf8"), "# BRIEF · alpha\n\nOriginal content.\n");
  assert.equal(fs.readFileSync(path.join(target, "BRIEF.md"), "utf8"), "---\nnarration_language: en-GB\n---\n\n# BRIEF · alpha\n\nOriginal content.\n");
});
