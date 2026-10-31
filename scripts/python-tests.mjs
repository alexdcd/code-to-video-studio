#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPython } from "./lib/python-runner.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
try {
  const result=runPython("-m",["unittest","discover","-s","scripts/tests","-p","test_production_*.py"],{
    cwd:root,
    stdio:"inherit",
  });
  if (result.error) throw result.error;
  process.exitCode=result.status ?? 1;
} catch (error) {
  console.error(`Python tests failed: ${error.message}`);
  process.exitCode=1;
}
