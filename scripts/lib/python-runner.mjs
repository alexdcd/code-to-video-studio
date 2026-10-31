import { spawnSync } from "node:child_process";

function candidates() {
  const configured = process.env.PYTHON;
  if (configured) return [{ command: configured, prefix: [] }];
  return process.platform === "win32"
    ? [{ command: "python", prefix: [] }, { command: "py", prefix: ["-3"] }, { command: "python3", prefix: [] }]
    : [{ command: "python3", prefix: [] }, { command: "python", prefix: [] }];
}

export function pythonInvocation() {
  for (const candidate of candidates()) {
    const check = spawnSync(candidate.command, [...candidate.prefix, "--version"], { encoding: "utf8", shell: false });
    if (!check.error && check.status === 0) return candidate;
  }
  throw new Error("Python 3 is required for this optional media tool. Set PYTHON to its executable path.");
}

export function runPython(script, args = [], options = {}) {
  const python = pythonInvocation();
  return spawnSync(python.command, [...python.prefix, script, ...args], { shell: false, encoding: "utf8", ...options });
}
