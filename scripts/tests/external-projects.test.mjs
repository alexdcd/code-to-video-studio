import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveProjectsRoot } from "../lib/project-paths.mjs";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const scripts=path.join(ROOT,"scripts");

function run(script,args,env) {
  const result=spawnSync(process.execPath,[path.join(scripts,script),...args],{
    cwd:ROOT,env:{...process.env,...env},encoding:"utf8",timeout:120000
  });
  assert.equal(result.status,0,`${script} failed: ${result.error?.message||""}\n${result.stdout}\n${result.stderr}`);
}

test("create, check, and setup work with an external projects root containing spaces", { timeout:240000 }, t => {
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"Code to Video Studio external root ")));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const env={CTV_PROJECTS_ROOT:root};
  const project=path.join(root,"external-smoke");
  run("new.mjs",["blank-16x9","external-smoke"],env);
  assert.ok(fs.existsSync(path.join(project,"index.html")));
  assert.ok(fs.existsSync(path.join(project,"assets/kit/lib/mafia.js")));
  const agent=fs.readFileSync(path.join(project,"AGENTS.md"),"utf8");
  const rel=agent.match(/Read `([^`]+)` first/);
  assert.ok(rel,"project instructions should link to root AGENTS");
  assert.equal(path.resolve(project,rel[1]),path.join(ROOT,"AGENTS.md"));
  run("in-project.mjs",["check","external-smoke"],env);
  fs.rmSync(path.join(project,"assets/kit"),{recursive:true,force:true});
  run("kit-copy.mjs",["external-smoke"],env);
  assert.ok(fs.existsSync(path.join(project,"assets/kit/lib/mafia.js")));
  fs.rmSync(path.join(project,"assets/kit"),{recursive:true,force:true});
  run("setup.mjs",[],env);
  assert.ok(fs.existsSync(path.join(project,"assets/kit/lib/mafia.js")));
});

test("reject a project root under versionable repository folders", () => {
  assert.throws(()=>resolveProjectsRoot(ROOT,{CTV_PROJECTS_ROOT:path.join(ROOT,"templates")}),/outside versionable Studio folders/);
  assert.throws(()=>resolveProjectsRoot(ROOT,{CTV_PROJECTS_ROOT:"relative-root"}),/absolute path/);
});
