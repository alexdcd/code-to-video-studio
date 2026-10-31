import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveProjectPath, resolveProjectsRoot } from "../lib/project-paths.mjs";

const STUDIO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = path.join(STUDIO_ROOT, "scripts/lib/project-paths.mjs");

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ctv-project-paths-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function createProject(root, name) {
  const project = path.join(root, name);
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(project, "index.html"), "<!doctype html>");
  return project;
}

test("default and external project roots resolve consistently", t => {
  const container = temporaryDirectory(t);
  const studio = path.join(container, "studio");
  fs.mkdirSync(studio);
  const external = path.join(container, "projects-outside-checkout");
  fs.mkdirSync(external);

  assert.equal(resolveProjectsRoot(studio, {}), path.join(studio, "proyectos"));
  assert.equal(resolveProjectsRoot(studio, { CTV_PROJECTS_ROOT: external }), external);
  assert.throws(() => resolveProjectsRoot(studio, { CTV_PROJECTS_ROOT: "relative/projects" }), /absolute path/);
});

test("only the ignored proyectos tree may be selected inside a Studio checkout", t => {
  const container = temporaryDirectory(t);
  const studio = path.join(container, "studio");
  const examples = path.join(studio, "ejemplos");
  const projects = path.join(studio, "proyectos");
  fs.mkdirSync(examples, { recursive: true });
  fs.mkdirSync(projects, { recursive: true });

  assert.equal(resolveProjectsRoot(studio, { CTV_PROJECTS_ROOT: projects }), projects);
  assert.throws(() => resolveProjectsRoot(studio, { CTV_PROJECTS_ROOT: examples }), /versionable Studio folders/);
  assert.throws(() => resolveProjectsRoot(studio, { CTV_PROJECTS_ROOT: path.join(examples, "future-projects") }), /versionable Studio folders/);

  const alias = path.join(container, "projects-alias");
  fs.symlinkSync(examples, alias, "dir");
  assert.throws(() => resolveProjectsRoot(studio, { CTV_PROJECTS_ROOT: alias }), /versionable Studio folders/);
});

test("missing project-root components preserve their order and stay within the ignored tree", t => {
  const repository = path.join(temporaryDirectory(t), "studio");
  fs.mkdirSync(path.join(repository, ".git"), { recursive: true });

  const versionablePath = path.join(repository, "trabajo", "proyectos");
  assert.throws(
    () => resolveProjectsRoot(repository, { CTV_PROJECTS_ROOT: versionablePath }),
    /versionable Studio folders/,
  );

  const ignoredPath = path.join(repository, "proyectos", "trabajo", "nuevo");
  assert.equal(resolveProjectsRoot(repository, { CTV_PROJECTS_ROOT: ignoredPath }), ignoredPath);
});

test("missing project-root components are resolved through symlinks", t => {
  const repository = path.join(temporaryDirectory(t), "studio");
  const projects = path.join(repository, "proyectos");
  fs.mkdirSync(path.join(repository, ".git"), { recursive: true });
  fs.mkdirSync(projects);

  const alias = path.join(repository, "projects-alias");
  fs.symlinkSync(projects, alias, "dir");
  const aliasedRoot = path.join(alias, "trabajo", "nuevo");
  assert.equal(resolveProjectsRoot(repository, { CTV_PROJECTS_ROOT: aliasedRoot }), aliasedRoot);
});

test("names, proyectos aliases and absolute paths resolve under the selected root", t => {
  const root = temporaryDirectory(t);
  const project = createProject(root, "demo");
  const canonicalProject = fs.realpathSync(project);
  const options = { studioRoot: STUDIO_ROOT, projectsRoot: root };

  assert.equal(resolveProjectPath("demo", options), canonicalProject);
  assert.equal(resolveProjectPath("proyectos/demo", options), canonicalProject);
  assert.equal(resolveProjectPath(project, options), canonicalProject);
});

test("relative local paths work and project paths cannot escape the selected root", t => {
  const container = temporaryDirectory(t);
  const root = path.join(container, "projects");
  const outside = path.join(container, "outside");
  fs.mkdirSync(root);
  fs.mkdirSync(outside);
  const project = createProject(root, "demo");
  const canonicalProject = fs.realpathSync(project);
  const options = { studioRoot: STUDIO_ROOT, projectsRoot: root, cwd: project };

  assert.equal(resolveProjectPath(".", options), canonicalProject);
  assert.throws(() => resolveProjectPath("../../outside", options), /inside CTV_PROJECTS_ROOT/);
  assert.throws(() => resolveProjectPath(outside, options), /inside CTV_PROJECTS_ROOT/);
});

test("the CLI uses CTV_PROJECTS_ROOT for named projects", t => {
  const root = temporaryDirectory(t);
  const project = createProject(root, "external-video");
  const result = spawnSync(process.execPath, [CLI, "project", "external-video"], {
    encoding: "utf8",
    env: { ...process.env, CTV_PROJECTS_ROOT: root },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), fs.realpathSync(project));

  const status = spawnSync(process.execPath, [path.join(STUDIO_ROOT, "scripts/project-status.mjs"), "external-video", "--json"], {
    encoding: "utf8",
    env: { ...process.env, CTV_PROJECTS_ROOT: root },
  });
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).project, "external-video");
});

test("project commands resolve named projects under CTV_PROJECTS_ROOT", t => {
  const root = temporaryDirectory(t);
  createProject(root, "external-project");
  const result = spawnSync(process.execPath, [path.join(STUDIO_ROOT, "scripts/in-project.mjs"), "check", "external-project"], {
    encoding: "utf8", env: { ...process.env, CTV_PROJECTS_ROOT: root },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /HyperFrames not installed|StaticGuard\] Invalid HyperFrame contract/);
});
