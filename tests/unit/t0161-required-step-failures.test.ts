/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PREFIX = "t0161-required-failures-";

function bashBin(): string {
  const gitBash = "C:\\Program Files\\Git\\bin\\bash.exe";
  return process.platform === "win32" && existsSync(gitBash) ? gitBash : "bash";
}

function dispose(root: string): void {
  const actual = realpathSync(root);
  if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
    throw new Error("INFRASTRUCTURE: fixture escaped the temporary directory");
  }
  rmSync(actual, { recursive: true, force: true });
}

const FAKE_NODE = String.raw`#!/usr/bin/env bash
  if [ "$1" = '-v' ]; then printf 'v24.0.0\n'; exit 0; fi
  if [ "$1" = '-e' ]; then printf 'fictional-fixture-only-key\n'; exit 0; fi
  step=other
  case "$*" in
    *migrate-to-runtime.mjs*) step=legacy ;;
    *hermes-registry-import.mjs*) step=registry ;;
  esac
  printf '%s\n' "$step" >> "$ORACLE_EVENTS"
  [ "$step" = "$ORACLE_FAIL_STEP" ] && exit 17
  exit 0
`;
const FAKE_NPX = String.raw`#!/usr/bin/env bash
  step=other
  case "$*" in
    *import-hermes-state.ts*) step=hermes-state ;;
    *seed-catalog.ts*) step=catalog ;;
    *ensure-hermes-model-sync.ts*) step=model-sync ;;
  esac
  printf '%s\n' "$step" >> "$ORACLE_EVENTS"
  [ "$step" = "$ORACLE_FAIL_STEP" ] && exit 17
  exit 0
`;
const FAKE_NPM = String.raw`#!/usr/bin/env bash
  step=other
  case "$*" in
    *db:migrate*) step=schema ;;
    *build*) step=build ;;
    *install*) step=install ;;
  esac
  printf '%s\n' "$step" >> "$ORACLE_EVENTS"
  [ "$step" = "$ORACLE_FAIL_STEP" ] && exit 17
  exit 0
`;

function runShellSetup(failStep: string): { root: string; result: ReturnType<typeof spawnSync>; events: string[] } {
  const root = mkdtempSync(join(tmpdir(), PREFIX));
  const dataDir = join(root, "data");
  const hermesHome = join(root, "hermes");
  const fakeBin = join(root, "bin");
  const eventsFile = join(root, "events.txt");
  mkdirSync(join(root, "scripts", "bootstrap"), { recursive: true });
  mkdirSync(join(root, "scripts", "lib"), { recursive: true });
  mkdirSync(dataDir);
  mkdirSync(hermesHome);
  mkdirSync(fakeBin);
  writeFileSync(join(dataDir, "patterstage.db"), "existing database sentinel");
  writeFileSync(join(dataDir, "patterstage.db-wal"), "canonical WAL sentinel");
  writeFileSync(join(dataDir, "patterstage.db-shm"), "canonical SHM sentinel");
  writeFileSync(join(dataDir, "control-hub.db"), "larger legacy database sentinel".repeat(12));
  writeFileSync(join(dataDir, "control-hub.db-wal"), "legacy WAL sentinel");
  writeFileSync(join(dataDir, "control-hub.db-shm"), "legacy SHM sentinel");
  writeFileSync(join(hermesHome, "config.yaml"), "model: fixture-only\n");
  writeFileSync(join(hermesHome, ".env"), "API_SERVER_KEY=fictional-fixture-only-key\nAPI_SERVER_ENABLED=true\n");
  for (const source of [
    "scripts/bootstrap/setup.sh", "scripts/lib/ps-env.sh", "scripts/lib/ps-dotenv-local.sh",
    "scripts/lib/ps-port.sh", "scripts/lib/ps-log.sh", "scripts/lib/ps-migrate.sh",
  ]) {
    copyFileSync(join(ROOT, source), join(root, source));
  }
  writeFileSync(join(fakeBin, "node"), FAKE_NODE, { mode: 0o755 });
  writeFileSync(join(fakeBin, "npx"), FAKE_NPX, { mode: 0o755 });
  writeFileSync(join(fakeBin, "npm"), FAKE_NPM, { mode: 0o755 });
  const script = `
    set -e
    if command -v cygpath >/dev/null 2>&1; then
      export ORACLE_ROOT="$(cygpath -u "$ORACLE_ROOT")"
      export ORACLE_DATA="$(cygpath -u "$ORACLE_DATA")"
      export ORACLE_HERMES="$(cygpath -u "$ORACLE_HERMES")"
      export ORACLE_FAKE_BIN="$(cygpath -u "$ORACLE_FAKE_BIN")"
      export ORACLE_EVENTS="$(cygpath -u "$ORACLE_EVENTS")"
    fi
    export HOME="$ORACLE_ROOT" PS_DATA_DIR="$ORACLE_DATA" HERMES_HOME="$ORACLE_HERMES"
    export PATH="$ORACLE_FAKE_BIN:$PATH" PORT=47326 PS_INSTALL_NONINTERACTIVE=1
    export PS_SETUP_RUN_TESTS=0 PS_SETUP_SKIP_CATALOG_SEED=0 CI=0
    bash "$ORACLE_ROOT/scripts/bootstrap/setup.sh"
  `;
  const result = spawnSync(bashBin(), ["-c", script], {
    cwd: ROOT,
    env: {
      ...process.env,
      ORACLE_ROOT: root,
      ORACLE_DATA: dataDir,
      ORACLE_HERMES: hermesHome,
      ORACLE_FAKE_BIN: fakeBin,
      ORACLE_EVENTS: eventsFile,
      ORACLE_FAIL_STEP: failStep,
    },
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
  });
  if (result.error || result.signal || !existsSync(eventsFile)) {
    dispose(root);
    throw new Error(`INFRASTRUCTURE: shell setup did not reach stubbed commands (${result.error?.message ?? result.signal ?? result.status}); ${result.stderr?.slice(-500) ?? ""}`);
  }
  return { root, result, events: readFileSync(eventsFile, "utf8").trim().split("\n") };
}

const DEPLOY_PRELOAD = String.raw`
  const cp = require('node:child_process');
  const fs = require('node:fs');
  let failedLegacy = false;
  cp.spawnSync = (command, args = []) => {
    const call = [command, ...args].join(' ');
    const step = call.includes('migrate-to-runtime.mjs') ? 'legacy'
      : call.includes('db:migrate') ? 'schema'
      : call.includes('hermes-registry-import.mjs') ? 'registry'
      : call.includes('import-hermes-state.ts') ? 'hermes-state'
      : call.includes('seed-catalog.ts') ? 'catalog'
      : call.includes('run build') ? 'build' : 'other';
    fs.appendFileSync(process.env.ORACLE_EVENTS, step + '\n');
    if (failedLegacy) throw new Error('required migration failed; later child command reached');
    if (step === 'legacy') {
      failedLegacy = true;
      return { status: 17, stdout: '', stderr: '' };
    }
    return { status: 0, stdout: '', stderr: '' };
  };
  require('node:module').syncBuiltinESMExports();
`;

function runDeployLegacyFailure(): { root: string; result: ReturnType<typeof spawnSync>; events: string[]; status: string } {
  const root = mkdtempSync(join(tmpdir(), PREFIX));
  const dataDir = join(root, "data");
  const hermesHome = join(root, "hermes");
  const eventsFile = join(root, "events.txt");
  const statusFile = join(root, "deploy.status");
  const preload = join(root, "preload.cjs");
  mkdirSync(join(root, "scripts", "tooling"), { recursive: true });
  mkdirSync(dataDir);
  mkdirSync(hermesHome);
  writeFileSync(join(dataDir, "patterstage.db"), "existing database sentinel");
  writeFileSync(join(hermesHome, "config.yaml"), "model: fixture-only\n");
  for (const source of ["scripts/tooling/ps-deploy.mjs", "scripts/tooling/_platform.mjs", "scripts/tooling/_env-local.mjs"]) {
    copyFileSync(join(ROOT, source), join(root, source));
  }
  writeFileSync(preload, DEPLOY_PRELOAD);
  // This assertion exercises failure propagation, so invoke the copied CLI by
  // its canonical path. The separate alias-path oracle covers entry detection.
  const deployScript = realpathSync(join(root, "scripts", "tooling", "ps-deploy.mjs"));
  const result = spawnSync(process.execPath, ["--require", preload, deployScript, "rebuild"], {
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
  if (result.error || result.signal || !existsSync(eventsFile) || !existsSync(statusFile)) {
    dispose(root);
    throw new Error(`INFRASTRUCTURE: deploy runner did not reach stubbed work (${result.error?.message ?? result.signal ?? result.status})`);
  }
  return {
    root,
    result,
    events: readFileSync(eventsFile, "utf8").trim().split("\n"),
    status: readFileSync(statusFile, "utf8"),
  };
}

describe("T-0161 required post-backup steps cannot report success on failure", () => {
  it("shell setup backs up both existing database candidates and sidecars before schema migration", () => {
    const fixture = runShellSetup("schema");
    try {
      expect(fixture.events).toContain("schema");
      const dataDir = join(fixture.root, "data");
      const names = readdirSync(dataDir);
      for (const base of ["patterstage.db", "control-hub.db"]) {
        const backups = names.filter((name) => name.startsWith(`${base}.pre-migrate-`) && name.endsWith(".bak"));
        expect(backups).toHaveLength(1);
        for (const suffix of ["", "-wal", "-shm"]) {
          expect(readFileSync(join(dataDir, `${backups[0]}${suffix}`))).toEqual(readFileSync(join(dataDir, `${base}${suffix}`)));
        }
      }
    } finally {
      dispose(fixture.root);
    }
  });

  it.each([
    ["legacy", "legacy-data migration"],
    ["hermes-state", "Hermes state import"],
    ["catalog", "catalog seed"],
  ])("shell setup stops after failed %s (%s)", (step) => {
    const fixture = runShellSetup(step);
    try {
      expect(fixture.events).toContain(step);
      expect({
        failed: fixture.result.status !== 0,
        reportedSuccess: (fixture.result.stdout ?? "").includes("Setup Complete!"),
      }).toEqual({ failed: true, reportedSuccess: false });
    } finally {
      dispose(fixture.root);
    }
  });

  it("deploy rebuild records failed migration and launches no later required work after legacy-data failure", () => {
    const fixture = runDeployLegacyFailure();
    try {
      expect(fixture.events).toContain("legacy");
      expect({
        failed: fixture.result.status !== 0,
        statusFailed: /^state=failed$/m.test(fixture.status),
        phaseIsMigration: /^phase=migrate$/m.test(fixture.status),
        laterCommands: fixture.events.slice(fixture.events.indexOf("legacy") + 1),
      }).toEqual({ failed: true, statusFailed: true, phaseIsMigration: true, laterCommands: [] });
    } finally {
      dispose(fixture.root);
    }
  });
});
