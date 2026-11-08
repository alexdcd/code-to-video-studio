#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, { encoding: capture ? "utf8" : undefined, stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit", shell: false });
  if (result.error) throw new Error(`Could not run ${command}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status ?? 1}${capture && result.stderr ? `: ${result.stderr.trim()}` : ""}`);
  return capture ? result.stdout.trim() : "";
}

function exists(file) {
  try { return fs.lstatSync(file); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

try {
  const [inputArg, crfArg = "20", ...extra] = process.argv.slice(2);
  if (!inputArg || extra.length || !/^(?:18|19|20|21|22|23|24)$/.test(crfArg)) {
    throw new Error("Usage: pnpm run web:encode <master.mp4> [CRF=20; integer 18-24]");
  }
  const inputPath = path.resolve(inputArg);
  const inputStat = fs.lstatSync(inputPath);
  if (!inputStat.isFile() || inputStat.isSymbolicLink() || !/\.mp4$/i.test(inputPath)) throw new Error("Input must be a regular MP4 file, not a symlink.");
  const input = fs.realpathSync(inputPath);
  const output = `${input.replace(/\.mp4$/i, "")}-web.mp4`;
  if (exists(output)) throw new Error(`Output already exists; it will not be overwritten: ${output}`);
  const temp = path.join(path.dirname(output), `.${path.basename(output, ".mp4")}.tmp-${process.pid}-${crypto.randomUUID()}.mp4`);
  const audioCodec = run("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name", "-of", "default=noprint_wrappers=1:nokey=1", input], { capture: true });
  const audioArgs = !audioCodec ? ["-an"] : audioCodec === "aac" ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", "192k"];
  try {
    console.log(`Encoding H.264 web MP4 · veryslow · CRF ${crfArg}`);
    run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-n", "-i", input,
      "-map_metadata", "-1", "-map_chapters", "-1", "-map", "0:v:0", "-map", "0:a:0?",
      "-c:v", "libx264", "-preset", "veryslow", "-crf", crfArg, "-pix_fmt", "yuv420p",
      "-profile:v", "high", "-movflags", "+faststart", ...audioArgs, temp]);
    fs.copyFileSync(temp, output, fs.constants.COPYFILE_EXCL);
  } finally {
    try { fs.unlinkSync(temp); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const sizeMb = (fs.statSync(output).size / 1_000_000).toFixed(2);
  console.log(`→ ${output}\nSize: ${sizeMb} MB · CRF ${crfArg}`);
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
