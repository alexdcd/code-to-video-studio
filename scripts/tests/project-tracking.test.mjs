import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const STUDIO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("production projects and reference analysis stay local while selected examples are trackable", t => {
  const repository = mkdtempSync(path.join(os.tmpdir(), "ctv-tracking-"));
  t.after(() => rmSync(repository, { recursive: true, force: true }));
  copyFileSync(path.join(STUDIO_ROOT, ".gitignore"), path.join(repository, ".gitignore"));
  mkdirSync(path.join(repository, "proyectos", "video"), { recursive: true });
  mkdirSync(path.join(repository, "references", "sample-reference"), { recursive: true });
  mkdirSync(path.join(repository, "examples", "selected"), { recursive: true });
  writeFileSync(path.join(repository, "proyectos/video/BRIEF.md"), "local project\n");
  writeFileSync(path.join(repository, "references/sample-reference/source.mp4"), "local video\n");
  writeFileSync(path.join(repository, "references/sample-reference/source.json"), "{}\n");
  writeFileSync(path.join(repository, "references/sample-reference/ANALYSIS.md"), "reviewed analysis\n");
  writeFileSync(path.join(repository, "examples/selected/BRIEF.md"), "selected example\n");

  const init = spawnSync("git", ["init", "--quiet"], { cwd: repository, encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);
  const add = spawnSync("git", ["add", "-A"], { cwd: repository, encoding: "utf8" });
  assert.equal(add.status, 0, add.stderr);
  const files = spawnSync("git", ["ls-files"], { cwd: repository, encoding: "utf8" });
  assert.equal(files.status, 0, files.stderr);
  assert.deepEqual(files.stdout.trim().split("\n").sort(), [
    ".gitignore",
    "examples/selected/BRIEF.md",
  ]);
});
