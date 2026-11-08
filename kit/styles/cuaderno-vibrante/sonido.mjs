#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TAU = Math.PI * 2;
function hash(n, seed) { const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); }
function wave(t, hz, phase = 0) { return Math.sin(TAU * hz * t + phase); }

export function makeNotebookAudio({ duration = 12, seed = 31, sampleRate = 24000 } = {}) {
  const frames = Math.max(1, Math.round(duration * sampleRate));
  const samples = new Int16Array(frames);
  const notes = [220, 261.63, 329.63, 293.66, 246.94, 196];
  const beat = 60 / 92;
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    const beatIndex = Math.floor(t / beat);
    const note = notes[beatIndex % notes.length];
    const phase = (t % beat) / beat;
    const fadeIn = Math.min(1, t / 0.18), fadeOut = Math.min(1, (duration - t) / 0.25);
    const pad = (wave(t, note, 0) * 0.45 + wave(t, note * 1.5, 0.4) * 0.18 + wave(t, note * 2, 1.2) * 0.08) * 0.17;
    const pulse = Math.pow(Math.max(0, 1 - phase), 5) * wave(t, note * 2, 0.2) * 0.12;
    const tickAt = t % 1.30435;
    const tickEnv = Math.exp(-tickAt * 45);
    const tick = (hash(i, seed) * 2 - 1) * tickEnv * 0.055;
    const transition = [4, 8].reduce((sum, at) => {
      const d = t - at;
      if (d < 0 || d > 0.5) return sum;
      return sum + (hash(i, seed + at) * 2 - 1) * Math.exp(-d * 18) * 0.07;
    }, 0);
    // Normalize the procedural bed to a practical listening level before the
    // safety limiter. The generated signal remains deterministic and bounded.
    const value = Math.max(-0.86, Math.min(0.86, (pad + pulse + tick + transition) * fadeIn * fadeOut * 2.4));
    samples[i] = Math.round(value * 32767);
  }
  return { samples, frames, sampleRate };
}

export function writeWav(filePath, options = {}) {
  const { samples, frames, sampleRate } = makeNotebookAudio(options);
  const dataBytes = frames * 2;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + dataBytes, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(dataBytes, 40);
  const data = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, Buffer.concat([header, data]));
  return { filePath, duration: frames / sampleRate, sampleRate, bytes: 44 + dataBytes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = path.resolve(process.argv[2] || "assets/audio/cuaderno-procedural-bed.wav");
  const duration = Number(process.argv[3] || 12);
  const result = writeWav(out, { duration });
  process.stdout.write(`Procedural cuaderno audio: ${result.filePath} · ${result.duration.toFixed(2)} s · ${result.sampleRate} Hz · ${result.bytes} bytes\n`);
}
