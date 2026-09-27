/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, sep } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PREFIX = "t0161-direct-invocation-";

const SPAWN_PRELOAD = String.raw`
  const cp = require('node:child_process');
  const fs = require('node:fs');
  cp.spawnSync = (command, args = []) => {
    const call = [command, ...args].join(' ');
    const step = call.includes('--version') ? 'tooling'
      : call.includes('run build') ? 'build' : 'unexpected';
    fs.appendFileSync(process.env.ORACLE_EVENTS, step + '\n');
    return { status: step === 'build' ? 17 : 0, stdout: '', stderr: '' };
  };
  require('node:module').syncBuiltinESMExports();
`;

function dispose(root: string): void {
  const actual = realpathSync(root);
  if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
    throw new Error("INFRASTRUCTURE: fixture escaped the temporary directory");
  }
  const alias = join(actual, "alias");
  if (existsSync(alias) && !realpathSync(alias).startsWith(actual + sep)) {
    throw new Error("INFRASTRUCTURE: alias points outside its fixture");
  }
  rmSync(actual, { recursive: true, force: true });
}

describe("T-0161 deploy CLI recognises an aliased entry path", () => {
  it("runs the rebuild command and reports its injected build failure through a path alias", () => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const realDir = join(root, "real");
      const aliasDir = join(root, "alias");
      const dataDir = join(root, "data");
      const hermesHome = join(root, "hermes");
      const preload = join(root, "spawn-preload.cjs");
      const eventsFile = join(root, "spawn-events.txt");
      const statusFile = join(root, "deploy.status");
      mkdirSync(join(realDir, "scripts", "tooling"), { recursive: true });
      mkdirSync(dataDir);
      mkdirSync(hermesHome);
      for (const source of ["scripts/tooling/ps-deploy.mjs", "scripts/tooling/_platform.mjs", "scripts/tooling/_env-local.mjs"]) {
        copyFileSync(join(ROOT, source), join(realDir, source));
      }
      writeFileSync(join(realDir, "identity-probe.mjs"),
        "import { fileURLToPath } from 'node:url'; console.log(JSON.stringify({modulePath:fileURLToPath(import.meta.url), argvPath:process.argv[1]}));\n");
      writeFileSync(preload, SPAWN_PRELOAD);
      try {
        symlinkSync(realDir, aliasDir, process.platform === "win32" ? "junction" : "dir");
      } catch (error) {
        throw new Error(`INFRASTRUCTURE: cannot create a path alias: ${String(error)}`);
      }
      if (realpathSync(aliasDir) !== realpathSync(realDir)) {
        throw new Error("INFRASTRUCTURE: alias does not resolve to the fixture directory");
      }

      const identity = spawnSync(process.execPath, [join(aliasDir, "identity-probe.mjs")], {
        cwd: root,
        env: { ...process.env, NODE_OPTIONS: "" },
        encoding: "utf8",
        timeout: 10_000,
        windowsHide: true,
      });
      if (identity.error || identity.signal || identity.status !== 0) {
        throw new Error(`INFRASTRUCTURE: alias identity probe failed (${identity.error?.message ?? identity.signal ?? identity.status})`);
      }
      const paths = JSON.parse(identity.stdout.trim()) as { modulePath: string; argvPath: string };
      if (realpathSync(paths.modulePath) !== realpathSync(paths.argvPath) || paths.modulePath === paths.argvPath) {
        throw new Error("INFRASTRUCTURE: fixture did not produce two spellings of the same CLI file");
      }

      const result = spawnSync(process.execPath, ["--require", preload, join(aliasDir, "scripts", "tooling", "ps-deploy.mjs"), "rebuild"], {
        cwd: root,
        env: {
          ...process.env,
          NODE_OPTIONS: "",
          PS_DATA_DIR: dataDir,
          HERMES_HOME: hermesHome,
          PS_DEPLOY_STATUS_FILE: statusFile,
          TMPDIR: root,
          ORACLE_EVENTS: eventsFile,
        },
        encoding: "utf8",
        timeout: 30_000,
        windowsHide: true,
      });
      if (result.error || result.signal) {
        throw new Error(`INFRASTRUCTURE: aliased CLI could not launch (${result.error?.message ?? result.signal})`);
      }
      const steps = existsSync(eventsFile) ? readFileSync(eventsFile, "utf8").trim().split("\n") : [];
      const status = existsSync(statusFile) ? readFileSync(statusFile, "utf8") : "";
      expect({
        exitCode: result.status,
        steps,
        failed: /^state=failed$/m.test(status),
        buildPhase: /^phase=build$/m.test(status),
      }).toEqual({ exitCode: 1, steps: ["tooling", "build"], failed: true, buildPhase: true });
    } finally {
      dispose(root);
    }
  });
});
