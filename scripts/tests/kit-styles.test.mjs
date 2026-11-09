import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const expectedStyles = ["cuaderno-vibrante", "editorial-motion"];
const expectedTemplates = [
  "cuaderno-vibrante-9x16",
  "editorial-motion-16x9",
  "editorial-motion-9x16",
];

test("free style registry contains exactly the selected creative styles", () => {
  const registry = readJson("kit/styles/registry.json");
  assert.deepEqual([...registry.creativeStyles].sort(), expectedStyles);
  assert.deepEqual([...registry.technicalTemplates].sort(), ["blank-16x9", "starter-9x16"]);

  const styleDirectories = fs.readdirSync(path.join(ROOT, "kit/styles"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "starter")
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(styleDirectories, expectedStyles);
  assert.equal(readJson("kit/styles/starter/ficha.json").type, "technical-template");
});

test("every free style and template has public metadata and local runtime dependencies", () => {
  for (const id of expectedStyles) {
    const resource = readJson(`kit/styles/${id}/resource.json`);
    assert.equal(resource.id, id);
    assert.equal(resource.distribution, "public");
    assert.ok(fs.existsSync(path.join(ROOT, `kit/styles/${id}/${id}.js`)));
    assert.ok(fs.existsSync(path.join(ROOT, `kit/styles/${id}/${id}.css`)));
    assert.ok(fs.existsSync(path.join(ROOT, `kit/styles/${id}/GUIA.md`)));
  }

  const templateDirectories = fs.readdirSync(path.join(ROOT, "templates"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && entry.name !== "starter-9x16" && entry.name !== "blank-16x9")
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(templateDirectories, expectedTemplates);

  for (const id of [...expectedTemplates, "starter-9x16", "blank-16x9"]) {
    const resource = readJson(`templates/${id}/resource.json`);
    assert.equal(resource.id, id);
    assert.equal(resource.distribution, "public");
    assert.ok(fs.existsSync(path.join(ROOT, `templates/${id}/index.html`)));
  }

  assert.ok(fs.existsSync(path.join(ROOT, "kit/fonts/inter.css")));
  assert.ok(fs.existsSync(path.join(ROOT, "kit/fonts/OFL.txt")));
  const gsapPackage = readJson("node_modules/gsap/package.json");
  assert.equal(gsapPackage.version, "3.15.0");
  const morphNpmPath = path.join(ROOT, "node_modules/gsap/dist/MorphSVGPlugin.min.js");
  const morphRuntimePath = path.join(ROOT, "kit/lib/vendor/gsap/MorphSVGPlugin.min.js");
  assert.ok(fs.existsSync(morphNpmPath), "gsap@3.15.0 must provide MorphSVGPlugin in dist/");
  assert.ok(fs.existsSync(morphRuntimePath), "setup must copy MorphSVGPlugin into the local runtime");
  const morphNpm = fs.readFileSync(morphNpmPath);
  const morphRuntime = fs.readFileSync(morphRuntimePath);
  assert.ok(morphRuntime.length > 20_000, "runtime plugin must be the real implementation, not a stub");
  assert.ok(morphRuntime.equals(morphNpm), "runtime plugin must match the pinned npm source exactly");
  assert.match(morphRuntime.toString("utf8"), /version:"3\.15\.0"/);
  assert.equal(fs.existsSync(path.join(ROOT, "kit/plugins/gsap")), false, "no vendored MorphSVG duplicate");

  for (const id of ["editorial-motion-16x9", "editorial-motion-9x16"]) {
    const index = fs.readFileSync(path.join(ROOT, `templates/${id}/index.html`), "utf8");
    const scene = fs.readFileSync(path.join(ROOT, `templates/${id}/compositions/s02.html`), "utf8");
    assert.match(index, /assets\/kit\/lib\/vendor\/gsap\/MorphSVGPlugin\.min\.js/);
    assert.match(scene, /EM\.morph\(/, `${id} must use an animated SVG morph`);
  }
  const vendorSource = fs.readFileSync(path.join(ROOT, "scripts/vendor.mjs"), "utf8");
  assert.match(vendorSource, /node_modules\/gsap\/dist/);
  assert.match(vendorSource, /MorphSVGPlugin is missing from installed gsap@3\.15\.0/);
  assert.doesNotMatch(vendorSource, /kit\/plugins\/gsap/);
});

test("public project templates do not depend on private brands, voices, or characters", () => {
  for (const id of expectedTemplates) {
    const directory = path.join(ROOT, `templates/${id}`);
    const compositionDirectory = path.join(directory, "compositions");
    const compositions = fs.existsSync(compositionDirectory)
      ? fs.readdirSync(compositionDirectory, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => `compositions/${entry.name}`)
      : [];
    const files = ["index.html", ...compositions];
    const source = files.map((rel) => fs.readFileSync(path.join(directory, rel), "utf8")).join("\n");
    assert.doesNotMatch(source, /assets\/kit\/(?:personajes|marcas|voces|estilos)\//i);
    const privateTokens = [
      ["alex", "dc"].join("-"), ["la", "mafia", "ia"].join("-"),
      ["el", "capo"].join("-"), ["hombre", "cubo"].join("-"), ["narrador", "o2"].join("-"),
    ];
    for (const token of privateTokens) assert.equal(source.toLowerCase().includes(token), false, `private reference in ${id}: ${token}`);
  }
});

test("the free Studio omits the duplicate variant engine and Pro social skill", () => {
  assert.equal(fs.existsSync(path.join(ROOT, "scripts/variant.mjs")), false);
  const pkg = readJson("package.json");
  assert.equal(Object.hasOwn(pkg.scripts, "variant"), false);
  assert.equal(Object.hasOwn(pkg.scripts, "variant:test"), false);
  const ids = readJson("skills/registry.json").skills.map((skill) => skill.id).sort();
  assert.deepEqual(ids, [
    "algorithmic-art-video",
    "creative-review",
    "gsap-video",
    "mafia-ai-character-creator",
    "reference-analyst",
  ]);
  assert.ok(readJson("skills/registry.json").skills.every((skill) => skill.distribution === "public"));
});

for (const format of ["16x9", "9x16"]) {
  test(`generated Editorial Motion ${format} resolves its brief, storyboard and title`, () => {
    const name = `editorial-test-${randomUUID()}`;
    const project = path.join(ROOT, "proyectos", name);
    try {
      execFileSync(process.execPath, ["scripts/new.mjs", `editorial-motion-${format}`, name], { cwd: ROOT });
      const brief = fs.readFileSync(path.join(project, "BRIEF.md"), "utf8");
      const guidePath = brief.match(/(assets\/kit\/styles\/editorial-motion\/)/)?.[1];
      const documents = ["BRIEF.md", "SCRIPT.md", "STORYBOARD.md", "index.html"]
        .map((file) => fs.readFileSync(path.join(project, file), "utf8"));
      assert.deepEqual({
        unresolvedTokens: documents.flatMap((text) => text.match(/\{\{(?:NOMBRE|FECHA|NAME|DATE)\}\}/g) ?? []),
        hasName: documents.every((text) => text.includes(name)),
        hasDate: /\*\*Fecha:\*\* \d{4}-\d{2}-\d{2}/.test(brief),
        hasStyleDocs: Boolean(guidePath && ["GUIA.md", "FRAME.md"].every(
          (file) => fs.existsSync(path.join(project, guidePath, file)),
        )),
      }, { unresolvedTokens: [], hasName: true, hasDate: true, hasStyleDocs: true });
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });
}
