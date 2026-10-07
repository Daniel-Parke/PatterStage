/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const EVIDENCE = join(ROOT, "tmp/t0207-node-oracle");
const BOUNDARY = "ORACLE_SETUP_SIDE_EFFECT_BOUNDARY";
const scripts = ["setup.mjs", "setup.sh", "install.sh"] as const;
const versions = [
  ["20.19.0", false],
  ["22.18.0", false],
  ["22.19.0", true],
  ["24.0.0", true],
] as const;

// Reuse the existing installer preload pattern. Execute the complete copied
// Node entry, but terminate before its first filesystem write or child command.
const PRELOAD = `
Object.defineProperty(process, 'version', { value: 'v' + process.env.ORACLE_VERSION });
Object.defineProperty(process.versions, 'node', { value: process.env.ORACLE_VERSION });
const boundary = () => { console.log('${BOUNDARY}'); process.exit(73); };
const fs = require('node:fs');
for (const name of ['mkdirSync', 'writeFileSync', 'appendFileSync', 'copyFileSync', 'chmodSync']) fs[name] = boundary;
const open = fs.openSync;
fs.openSync = (path, flags, ...args) => flags === 'r' ? open(path, flags, ...args) : boundary();
require('node:child_process').spawnSync = boundary;
require('node:module').syncBuiltinESMExports();
`;

function bashExecutable(): string {
  const gitBash = "C:/Program Files/Git/bin/bash.exe";
  return process.platform === "win32" && existsSync(gitBash) ? gitBash : "bash";
}

function shellPath(path: string): string {
  if (process.platform !== "win32") return path;
  const result = spawnSync(bashExecutable(), ["-c", 'cygpath -u "$1"', "oracle", path], { encoding: "utf8", windowsHide: true });
  if (result.error || result.status !== 0) throw new Error("INFRASTRUCTURE: Git Bash path conversion failed");
  return result.stdout.trim();
}

function runGuard(script: typeof scripts[number], version: string) {
  mkdirSync(EVIDENCE, { recursive: true });
  const owned = mkdtempSync(join(EVIDENCE, "fixture-"));
  try {
    const bootstrap = join(owned, "scripts/bootstrap");
    mkdirSync(bootstrap, { recursive: true });
    mkdirSync(join(owned, "scripts/tooling"));
    mkdirSync(join(owned, "home"));
    const entry = join(bootstrap, script);
    const preload = join(owned, "preload.cjs");
    writeFileSync(preload, PRELOAD);
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      SystemRoot: process.env.SystemRoot,
      PATH: process.env.PATH,
      HOME: owned,
      USERPROFILE: owned,
      CI: "1",
      PS_INSTALL_NONINTERACTIVE: "1",
      ORACLE_VERSION: version,
    };
    let executable = process.execPath;
    let args = ["--require", preload, entry];
    if (script === "setup.mjs") {
      for (const relative of ["scripts/bootstrap/setup.mjs", "scripts/bootstrap/env-local.mjs", "scripts/tooling/_platform.mjs"]) {
        copyFileSync(join(ROOT, relative), join(owned, relative));
      }
    } else {
      // Bounded structural scope: the unchanged prefix contains the live guard.
      // Stop at the existing next-phase comment, before PORT/Hermes/install work.
      // Source-library loading is stubbed; no operator library or data is read.
      const source = readFileSync(join(ROOT, "scripts/bootstrap", script), "utf8");
      const nextPhase = script === "setup.sh" ? /^# .*PORT \+ LAN/m : /^# .*Hermes CLI: optional install/m;
      const boundaryIndex = source.search(nextPhase);
      if (boundaryIndex < 0) throw new Error("INFRASTRUCTURE: installer phase boundary not found");
      writeFileSync(entry, source.slice(0, boundaryIndex) + `\nprintf '%s\\n' '${BOUNDARY}'\n`);
      executable = bashExecutable();
      env.HOME = shellPath(join(owned, "home"));
      env.ORACLE_NODE = shellPath(process.execPath);
      env.ORACLE_PRELOAD = shellPath(preload);
      args = ["-c", `
source() { :; }
ps_print_hermes_install_paths() { :; }
node() {
  if [[ "$1" == '-v' || "$1" == '--version' ]]; then printf 'v%s\\n' "$ORACLE_VERSION";
  else "$ORACLE_NODE" --require "$ORACLE_PRELOAD" "$@"; fi
}
export -f source ps_print_hermes_install_paths node
bash "$1"
`, "oracle", shellPath(entry)];
    }
    const result = spawnSync(executable, args, { cwd: owned, env, encoding: "utf8", timeout: 5_000, windowsHide: true });
    if (result.error || result.signal) throw new Error(`INFRASTRUCTURE: guard launch failed (${result.error?.message ?? result.signal})`);
    const reached = result.stdout.includes(BOUNDARY);
    // Loader/shell errors must never count as a successful runtime rejection.
    if (!reached && !/Node\.js.*required|Node\.js.*22\.19|requires.*Node/i.test(result.stdout + result.stderr)) {
      throw new Error(`INFRASTRUCTURE: no version refusal or setup boundary (${result.status}): ${result.stderr}`);
    }
    return { status: result.status, reached, wroteEnvironment: existsSync(join(owned, ".env.local")) };
  } finally {
    // owned is produced only by mkdtempSync beneath this lane's evidence path.
    if (!resolve(owned).startsWith(resolve(EVIDENCE) + "/") && !resolve(owned).startsWith(resolve(EVIDENCE) + "\\")) {
      throw new Error("INFRASTRUCTURE: fixture cleanup escaped owned evidence");
    }
    rmSync(owned, { recursive: true, force: true });
  }
}

describe("T-0207 research runtime minimum", () => {
  for (const script of scripts) {
    for (const [version, permitted] of versions) {
      it(`${script} ${permitted ? "permits" : "refuses"} Node ${version} before setup side effects`, () => {
        const actual = runGuard(script, version);
        expect(actual).toEqual({ status: permitted ? (script === "setup.mjs" ? 73 : 0) : 1, reached: permitted, wroteEnvironment: false });
      });
    }
  }

  it("package declares the accepted Node >=22.19.0 minimum (structural contract)", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(manifest.engines.node).toBe(">=22.19.0");
  });
});
