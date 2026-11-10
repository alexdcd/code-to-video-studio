import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { retargetStudioReferences } from "../lib/project-paths.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const bashAvailable = process.platform !== "win32" && fs.existsSync(path.join(ROOT, "scripts/en-proyecto.sh"));
const wrappers = bashAvailable ? ["node", "bash"] : ["node"];
const report = { ok: false, lint: { findings: [{ severity: "error", code: "fixture", message: "Broken asset", sourceFile: "scene.html", selector: "#hero", time: 2, fixHint: "Restore asset" }], errorCount: 1 }, layout: { samples: [2, 3.5, 7, 9.5], transitionSamplesDropped: 2 } };
function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ctv check spaces-")));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const file of ["in-project.mjs", "render-version-ledger.mjs", "lib/render-pipeline.mjs", "lib/project-paths.mjs", "lib/scene-times.mjs", "lib/review-core.mjs", "lib/check_summary.py", ...(bashAvailable ? ["en-proyecto.sh"] : [])]) {
    const dest = path.join(root, "scripts", file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(ROOT, "scripts", file), dest);
  }
  const project = path.join(root, "proyectos", "film with spaces");
  fs.mkdirSync(project, { recursive: true }); fs.writeFileSync(path.join(project, "index.html"), "fixture");
  const hf = path.join(root, "node_modules/hyperframes/bin/hyperframes.mjs");
  fs.mkdirSync(path.dirname(hf), { recursive: true });
  fs.writeFileSync(hf, `import fs from 'node:fs';
const args=process.argv.slice(2); fs.appendFileSync(process.env.CALLS,JSON.stringify(args)+'\\n');
if(args[0]==='timeline') { if(process.env.TIMELINE_FAIL) process.exit(1); console.log(JSON.stringify({timeline:{duration:10,tracks:[{kind:'graphics',rows:[{id:'s1',start:0,end:4},{id:'s2',start:4,end:10}]}]}})); }
else { process.stdout.write(process.env.REPORT); process.exit(Number(process.env.EXIT || 0)); }
`);
  if (bashAvailable) {
    const bin = path.join(root, "node_modules/.bin/hyperframes"); fs.mkdirSync(path.dirname(bin), { recursive: true });
    fs.writeFileSync(bin, '#!/usr/bin/env bash\nexec node "$(dirname "$0")/../hyperframes/bin/hyperframes.mjs" "$@"\n', { mode: 0o755 });
  }
  return { root, project, run(wrapper, args = [], env = {}, projectArg = "film with spaces") {
    const calls = path.join(root, `calls-${wrapper}.jsonl`); fs.writeFileSync(calls, "");
    const result = spawnSync(wrapper === "node" ? process.execPath : "bash", [path.join(root, `scripts/${wrapper === "node" ? "in-project.mjs" : "en-proyecto.sh"}`), "check", projectArg, ...args], { cwd: root, encoding: "utf8", env: { ...process.env, CTV_PROJECTS_ROOT: path.join(root, "proyectos"), CALLS: calls, REPORT: JSON.stringify(report), ...env } });
    return { ...result, calls: fs.readFileSync(calls, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse) };
  } };
}
for (const wrapper of wrappers) {
  test(`${wrapper}: defaults cover every scene, persist one report and summarize failure`, t => {
    const f = fixture(t); const r = f.run(wrapper, [], { EXIT: "7" });
    assert.equal(r.status, 7, r.stderr);
    assert.deepEqual(r.calls, [["timeline", "--json"], ["check", "--timeout", "90000", "--at", "2,3.5,7,9.5", "--frame-check", "--json"]]);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.project, "renders/check.json"))), report);
    assert.match(r.stdout, /error: fixture: Broken asset/, r.stderr); assert.match(r.stdout, /scene.html #hero t=2s/); assert.match(r.stdout, /Fix: Restore asset/); assert.match(r.stdout, /2 transition sample\(s\) omitted/);
    assert.deepEqual(fs.readdirSync(path.join(f.project, "renders")), ["check.json"]);
  });
  for (const args of [["--at", "1,8", "--timeout", "1234", "--frame-check"], ["--samples=3", "--timeout=2345", "--frame-check=true"]]) {
    test(`${wrapper}: explicit sampling and timeout survive ${args.join(" ")}`, t => {
      const f = fixture(t); const r = f.run(wrapper, [...args, "--json"]);
      assert.equal(r.status, 0, r.stderr); assert.deepEqual(r.calls, [["check", ...args, "--json"]]); assert.equal(r.stdout, JSON.stringify(report));
    });
  }
  test(`${wrapper}: failed timeline falls back, invalid JSON preserves prior evidence and exit`, t => {
    const f = fixture(t); fs.mkdirSync(path.join(f.project, "renders")); fs.writeFileSync(path.join(f.project, "renders/check.json"), '{"previous":true}');
    const r = f.run(wrapper, [], { TIMELINE_FAIL: "1", REPORT: "browser failed\n", EXIT: "3" });
    assert.equal(r.status, 3); assert.deepEqual(r.calls.at(-1), ["check", "--timeout", "90000", "--frame-check", "--json"]); assert.equal(r.stdout, "browser failed\n");
    assert.equal(fs.readFileSync(path.join(f.project, "renders/check.json"), "utf8"), '{"previous":true}');
  });
  test(`${wrapper}: configured external root and absolute project path work`, t => {
    const f = fixture(t); const external = fs.mkdtempSync(path.join(os.tmpdir(), "ctv external projects-")); t.after(() => fs.rmSync(external, { recursive: true, force: true })); const project = path.join(external, "film"); fs.mkdirSync(project); fs.writeFileSync(path.join(project, "index.html"), "fixture");
    const r = f.run(wrapper, ["--json"], { CTV_PROJECTS_ROOT: external }, project); assert.equal(r.status, 0, r.stderr); assert.ok(fs.existsSync(path.join(project, "renders/check.json")));
  });
  test(`${wrapper}: rejects traversal, root itself, missing index and symlink escapes before execution`, t => {
    const f = fixture(t); const outside = path.join(f.root, "outside"); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, "index.html"), "fixture");
    fs.mkdirSync(path.join(f.root, "proyectos", "empty"));
    const inputs = ["../outside", outside, "proyectos", "empty"];
    const link = path.join(f.root, "proyectos", "linked"); fs.symlinkSync(outside, link, process.platform === "win32" ? "junction" : "dir"); inputs.push("linked");
    for (const input of inputs) { const r = f.run(wrapper, [], {}, input); assert.notEqual(r.status, 0, input); assert.deepEqual(r.calls, [], input); }
  });
}


test("Desktop legacy Bash runner preserves absolute render project, note and exit status", { skip: !bashAvailable }, t => {
  const f = fixture(t);
  const resultPath = path.join(f.project, "desktop-render.json");
  fs.writeFileSync(path.join(f.root, "scripts/lib/render-pipeline.mjs"), `
import fs from "node:fs";
export function renderProject({projectDir, note, hyperframesArgs, hyperframesBin}) {
  fs.writeFileSync(process.env.RENDER_OUTPUT, JSON.stringify({projectDir, note, hyperframesArgs, hyperframesBin}));
  return {status: Number(process.env.RENDER_EXIT || 0)};
}
`);
  const args = [path.join(f.root, "scripts/en-proyecto.sh"), "render", f.project, "Desktop note with spaces"];
  const env = { ...process.env, CTV_PROJECTS_ROOT: path.join(f.root, "proyectos"), RENDER_OUTPUT: resultPath };
  const ok = spawnSync("bash", args, { cwd: f.root, encoding: "utf8", env });
  assert.equal(ok.status, 0, ok.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(resultPath, "utf8")), {
    projectDir: fs.realpathSync(f.project),
    note: "Desktop note with spaces",
    hyperframesArgs: [],
    hyperframesBin: [process.execPath, path.join(f.root, "node_modules/hyperframes/bin/hyperframes.mjs")]
  });
  const failed = spawnSync("bash", args, { cwd: f.root, encoding: "utf8", env: { ...env, RENDER_EXIT: "9" } });
  assert.equal(failed.status, 9, failed.stderr);
});


test("Windows cmd.exe executes a retargeted Node script across paths with spaces", { skip: process.platform !== "win32" }, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ctv windows command-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const studio = path.join(root, "Studio with spaces");
  const project = path.join(root, "external project");
  fs.mkdirSync(path.join(studio, "scripts"), { recursive: true });
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(studio, "scripts/probe.mjs"), 'process.stdout.write("windows-ok")');
  const command = retargetStudioReferences('node "../../scripts/probe.mjs"', project, studio, { shell: true });
  const result = spawnSync(command, { cwd: project, encoding: "utf8", shell: true }); // Node uses cmd.exe with verbatim shell arguments.
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "windows-ok");
});
