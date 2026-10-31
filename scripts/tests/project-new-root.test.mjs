import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createProject } from "../new.mjs";

test("new projects honor an external projects root and run the normal kit copy step", t => {
  const base=fs.mkdtempSync(path.join(os.tmpdir(),"ctv-new-root-"));
  t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
  const studio=path.join(base,"studio");
  const external=path.join(base,"user-projects");
  fs.mkdirSync(path.join(studio,".git"),{recursive:true});
  fs.mkdirSync(path.join(studio,"templates","starter"),{recursive:true});
  fs.mkdirSync(path.join(studio,"templates","_common"),{recursive:true});
  fs.mkdirSync(path.join(studio,"kit"),{recursive:true});
  fs.writeFileSync(path.join(studio,"templates","starter","index.html"),"<!-- {{NAME}} / {{TEMPLATE}} / {{KIT}} -->");
  fs.writeFileSync(path.join(studio,"templates","starter","resource.json"),"{}");
  fs.writeFileSync(path.join(studio,"templates","_common","BRIEF.md"),"Name: {{NAME}}\nCreated: {{DATE}}\n");
  fs.writeFileSync(path.join(studio,"kit","VERSION"),"0.3.0\n");

  let kitTarget=null;
  const project=createProject({
    template:"starter",name:"external-demo",studioRoot:studio,projectsRoot:external,
    copyKitFn(target){kitTarget=target;},
  });
  assert.equal(project,path.join(external,"external-demo"));
  assert.equal(kitTarget,project);
  assert.match(fs.readFileSync(path.join(project,"index.html"),"utf8"),/external-demo \/ starter \/ 0\.3\.0/);
  assert.match(fs.readFileSync(path.join(project,"BRIEF.md"),"utf8"),/Name: external-demo/);
  assert.equal(fs.existsSync(path.join(project,"resource.json")),false);
  assert.throws(()=>createProject({template:"starter",name:"external-demo",studioRoot:studio,projectsRoot:external}),/already exists/);
});

test("project creation refuses versionable folders inside the Studio checkout", t => {
  const base=fs.mkdtempSync(path.join(os.tmpdir(),"ctv-new-root-boundary-"));
  t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
  const studio=path.join(base,"studio");
  fs.mkdirSync(path.join(studio,".git"),{recursive:true});
  fs.mkdirSync(path.join(studio,"templates","starter"),{recursive:true});
  fs.mkdirSync(path.join(studio,"templates","_common"),{recursive:true});
  fs.mkdirSync(path.join(studio,"kit"),{recursive:true});
  fs.writeFileSync(path.join(studio,"templates","starter","index.html"),"<html></html>");
  fs.writeFileSync(path.join(studio,"kit","VERSION"),"0.3.0\n");
  assert.throws(
    ()=>createProject({template:"starter",name:"unsafe",studioRoot:studio,projectsRoot:path.join(studio,"ejemplos")}),
    /versionable Studio folders/,
  );
});
