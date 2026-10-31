import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { renderProject } from "../lib/render-pipeline.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function available(executable) {
  const result = spawnSync(executable, ["-version"], { stdio: "ignore" });
  return !result.error && result.status === 0;
}

const ENABLED = process.platform !== "win32" && available("ffmpeg") && available("ffprobe")
  && !spawnSync("bash", ["-c", "true"], { stdio: "ignore" }).error;

function run(executable, args, cwd) {
  const result = spawnSync(executable, args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.error?.message || "command failed");
}

function tags(file) {
  const result = spawnSync("ffprobe", [
    "-v", "error", "-show_entries", "format_tags=title,comment,description,artist",
    "-of", "json", file,
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout).format?.tags ?? {};
}

test("social and web exports never inherit source MP4 tags", { skip: !ENABLED }, t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ctv-export-metadata-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const project = path.join(tmp, "video-variant");
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, "index.html"), "<html></html>");
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=black:s=64x64:r=8:d=1",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
    "-metadata", "title=SOURCE-PROJECT",
    "-metadata", "comment=SOURCE-ID=example",
    "seed.mp4",
  ], project);
  assert.equal(tags(path.join(project, "seed.mp4")).title, "SOURCE-PROJECT");

  // Fake HyperFrames only: copy a media fixture to the numbered master path.
  const hyperframes = path.join(tmp, "fake-hyperframes");
  fs.writeFileSync(hyperframes, `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const at = args.indexOf("--output");
if (args[0] !== "render" || at < 0) process.exit(2);
fs.copyFileSync("seed.mp4", args[at + 1]);
`, { mode: 0o700 });
  const result = renderProject({ projectDir: project, hyperframesBin: hyperframes });
  assert.equal(result.status, 0);
  assert.equal(tags(result.master).title, "SOURCE-PROJECT");

  const social = tags(result.redes);
  assert.equal(social.title, undefined);
  assert.equal(social.comment, undefined);

  run("bash", [path.join(ROOT, "scripts/web-encode.sh"), result.master, "24"], project);
  const web = tags(result.master.replace(/\.mp4$/, "-web.mp4"));
  assert.equal(web.title, undefined);
  assert.equal(web.comment, undefined);
});
