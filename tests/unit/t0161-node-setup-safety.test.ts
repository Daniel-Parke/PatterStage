/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PREFIX = "t0161-node-setup-";
const EXISTING_DB = Buffer.from("existing database sentinel, before setup");

type Event = { step: string; backupAtMigration: boolean };
type Fixture = { root: string; dataDir: string; result: ReturnType<typeof spawnSync>; events: Event[] };

// The preload intercepts only external commands. The copied setup entry and
// its real local modules still execute their control flow and filesystem work.
const SPAWN_PRELOAD = String.raw`
  const cp = require('node:child_process');
  const fs = require('node:fs');
  const path = require('node:path');
  cp.spawnSync = (command, args = []) => {
    const call = [command, ...args].join(' ');
    const step = call.includes('migrate-db.ts') || call.includes('run db:migrate') ? 'schema'
      : call.includes('migrate-to-runtime.mjs') ? 'legacy'
      : call.includes('hermes-registry-import.mjs') ? 'registry'
      : call.includes('import-hermes-state.ts') ? 'hermes-state'
      : call.includes('seed-catalog.ts') ? 'catalog'
      : call.includes('ensure-hermes-model-sync.ts') ? 'model-sync'
      : call.includes('discover-agents.mjs') ? 'discover'
      : call.includes('run build') ? 'build'
      : call.includes('install') ? 'install' : 'other';
    const backups = fs.readdirSync(process.env.ORACLE_DATA_DIR)
      .filter(name => /^patterstage[.]db[.]pre-migrate-.*[.]bak$/.test(name));
    const backupAtMigration = backups.some(name => fs.readFileSync(path.join(process.env.ORACLE_DATA_DIR, name))
      .equals(Buffer.from('existing database sentinel, before setup')));
    fs.appendFileSync(process.env.ORACLE_EVENTS, JSON.stringify({step, backupAtMigration}) + '\n');
    return { status: step === process.env.ORACLE_FAIL_STEP ? 17 : 0, stdout: '', stderr: '' };
  };
  require('node:module').syncBuiltinESMExports();
`;

function dispose(root: string): void {
  const actual = realpathSync(root);
  if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
    throw new Error("INFRASTRUCTURE: fixture escaped the temporary directory");
  }
  rmSync(actual, { recursive: true, force: true });
}

function setupFixture(failStep = ""): Fixture {
  const root = mkdtempSync(join(tmpdir(), PREFIX));
  const dataDir = join(root, "data");
  const hermesHome = join(root, "hermes");
  const eventsPath = join(root, "spawn-events.jsonl");
  const preload = join(root, "spawn-preload.cjs");
  mkdirSync(join(root, "scripts", "bootstrap"), { recursive: true });
  mkdirSync(join(root, "scripts", "tooling"), { recursive: true });
  mkdirSync(dataDir);
  mkdirSync(hermesHome);
  writeFileSync(join(dataDir, "patterstage.db"), EXISTING_DB);
  writeFileSync(join(hermesHome, "config.yaml"), "model: fixture-only\n");
  for (const [source, destination] of [
    ["scripts/bootstrap/setup.mjs", "scripts/bootstrap/setup.mjs"],
    ["scripts/bootstrap/env-local.mjs", "scripts/bootstrap/env-local.mjs"],
    ["scripts/tooling/_platform.mjs", "scripts/tooling/_platform.mjs"],
  ]) {
    copyFileSync(join(ROOT, source), join(root, destination));
  }
  writeFileSync(preload, SPAWN_PRELOAD);
  const result = spawnSync(process.execPath, ["--require", preload, join(root, "scripts", "bootstrap", "setup.mjs")], {
    cwd: root,
    env: {
      ...process.env,
      NODE_OPTIONS: "",
      PORT: "47321",
      PS_DATA_DIR: dataDir,
      HERMES_HOME: hermesHome,
      ORACLE_DATA_DIR: dataDir,
      ORACLE_EVENTS: eventsPath,
      ORACLE_FAIL_STEP: failStep,
    },
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
  });
  if (result.error || result.signal || !existsSync(eventsPath)) {
    dispose(root);
    throw new Error(`INFRASTRUCTURE: Node setup fixture did not reach command interception (${result.error?.message ?? result.signal ?? result.status})`);
  }
  const events = readFileSync(eventsPath, "utf8").trim().split("\n").map((line) => JSON.parse(line) as Event);
  return { root, dataDir, result, events };
}

describe("T-0161 cross-platform Node setup protects existing data", () => {
  it("backs up before schema migration and imports Hermes models and credentials after migration", () => {
    const fixture = setupFixture();
    try {
      const schemaIndex = fixture.events.findIndex((event) => event.step === "schema");
      const registryIndex = fixture.events.findIndex((event) => event.step === "registry");
      const stateIndex = fixture.events.findIndex((event) => event.step === "hermes-state");
      const catalogIndex = fixture.events.findIndex((event) => event.step === "catalog");
      expect({
        setupSucceeded: fixture.result.status === 0,
        backedUpBeforeMigration: schemaIndex >= 0 && fixture.events[schemaIndex].backupAtMigration,
        registryAfterMigration: registryIndex > schemaIndex,
        stateAfterRegistry: stateIndex > registryIndex,
        catalogAfterState: catalogIndex > stateIndex,
        originalUnchanged: readFileSync(join(fixture.dataDir, "patterstage.db")).equals(EXISTING_DB),
      }).toEqual({
        setupSucceeded: true,
        backedUpBeforeMigration: true,
        registryAfterMigration: true,
        stateAfterRegistry: true,
        catalogAfterState: true,
        originalUnchanged: true,
      });
      expect(readdirSync(fixture.dataDir).filter((name) => /^patterstage[.]db[.]pre-migrate-.*[.]bak$/.test(name))).toHaveLength(1);
    } finally {
      dispose(fixture.root);
    }
  });

  it.each([
    ["schema", "schema migration"],
    ["legacy", "legacy data migration"],
    ["registry", "Hermes model registry import"],
    ["hermes-state", "Hermes state import"],
    ["catalog", "catalog seed"],
    ["model-sync", "Hermes model sync"],
  ])("stops without Setup Complete when %s fails (%s)", (step) => {
    const fixture = setupFixture(step);
    try {
      const calls = fixture.events.map((event) => event.step);
      expect(calls).toContain(step); // Missing required work is a genuine failure.
      expect({
        failed: fixture.result.status !== 0,
        reportedSuccess: (fixture.result.stdout ?? "").includes("Setup Complete!"),
        laterRequiredWork: calls.slice(calls.indexOf(step) + 1).some((next) =>
          ["schema", "legacy", "registry", "hermes-state", "catalog", "model-sync"].includes(next)),
      }).toEqual({ failed: true, reportedSuccess: false, laterRequiredWork: false });
    } finally {
      dispose(fixture.root);
    }
  });
});
