#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

function run(command, args, capture = false) {
  const result = spawnSync(command, args, { encoding: capture ? "utf8" : undefined, stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit", shell: false });
  if (result.error) throw new Error(`Could not run ${command}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status ?? 1}${capture && result.stderr ? `: ${result.stderr.trim()}` : ""}`);
  return capture ? result.stdout.trim() : "";
}

try {
  const [inputArg, outputArg, hpArg = "150", lpArg = "9500", fadeArg = "0.15", ...extra] = process.argv.slice(2);
  const hp = Number(hpArg), lp = Number(lpArg), fade = Number(fadeArg);
  if (!inputArg || !outputArg || extra.length || !Number.isFinite(hp) || !Number.isFinite(lp) || !Number.isFinite(fade)
    || hp < 20 || lp <= hp || lp > 20000 || fade <= 0) {
    throw new Error("Usage: pnpm run sfx:clean <input> <output.wav> [highpass=150] [lowpass=9500] [fade=0.15]");
  }
  const inputPath = path.resolve(inputArg);
  const inputStat = fs.lstatSync(inputPath);
  if (!inputStat.isFile() || inputStat.isSymbolicLink()) throw new Error("Input must be a regular file, not a symlink.");
  const input = fs.realpathSync(inputPath);
  const output = path.resolve(outputArg);
  if (!/\.wav$/i.test(output)) throw new Error("Output must be a WAV file.");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  try {
    const stat = fs.lstatSync(output);
    if (stat) throw new Error(`Output already exists; it will not be overwritten: ${output}`);
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const duration = Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", input], true));
  if (!Number.isFinite(duration) || fade >= duration) throw new Error("Output fade must be shorter than the input audio.");
  const temp = path.join(path.dirname(output), `.${path.basename(output, ".wav")}.tmp-${process.pid}-${crypto.randomUUID()}.wav`);
  try {
    run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-n", "-i", input, "-af",
      `highpass=f=${hp},lowpass=f=${lp},afade=t=in:d=0.005,afade=t=out:st=${duration - fade}:d=${fade}`,
      "-ar", "48000", temp]);
    fs.copyFileSync(temp, output, fs.constants.COPYFILE_EXCL);
  } finally {
    try { fs.unlinkSync(temp); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  console.log(`→ ${output}`);
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
