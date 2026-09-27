/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- create a real disposable SQLite database for the rebuild path */

import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = join(__dirname, "..", "..");
const PREFIX = "t0161-backup-creation-";
type RealDb = import("better-sqlite3").Database;
const DatabaseCtor = require(join(ROOT, "node_modules", "better-sqlite3", "lib", "index.js")) as new (path: string) => RealDb;
type CopyEvent = { name: string; modeAtCreation: number };

const COPY_PRELOAD = String.raw`
  const fs = require('node:fs');
  const cp = require('node:child_process');
  const path = require('node:path');
  const copy = fs.copyFileSync;
  process.umask(0);
  fs.copyFileSync = (source, destination, ...options) => {
    copy(source, destination, ...options);
    if (/[.]pre-(?:migrate|baseline)-/.test(destination)) {
      fs.appendFileSync(process.env.ORACLE_COPY_EVENTS, JSON.stringify({
        name: path.basename(destination),
        modeAtCreation: fs.statSync(destination).mode & 0o777,
      }) + '\n');
    }
  };
  cp.spawnSync = () => ({status: 0, stdout: '', stderr: ''});
  require('node:module').syncBuiltinESMExports();
`;

function fixture(bothCandidates: boolean): { root: string; dataDir: string; hermesHome: string; eventFile: string; preload: string } {
  const root = mkdtempSync(join(tmpdir(), PREFIX));
  const dataDir = join(root, "data");
  const hermesHome = join(root, "hermes");
  const eventFile = join(root, "copy-events.jsonl");
  const preload = join(root, "copy-preload.cjs");
  mkdirSync(dataDir);
  mkdirSync(hermesHome);
  writeFileSync(preload, COPY_PRELOAD);
  for (const [base, data] of [
    ["patterstage.db", Buffer.alloc(64, 0x11)],
    ...(bothCandidates ? [["control-hub.db", Buffer.alloc(4096, 0x22)] as const] : []),
  ] as Array<readonly [string, Buffer]>) {
    for (const [suffix, bytes] of [
      ["", data],
      ["-wal", Buffer.from(`${base} WAL sentinel`)],
      ["-shm", Buffer.from(`${base} SHM sentinel`)],
    ] as Array<readonly [string, Buffer]>) {
      const source = join(dataDir, base + suffix);
      writeFileSync(source, bytes);
      if (process.platform !== "win32") chmodSync(source, 0o644);
    }
  }
  return { root, dataDir, hermesHome, eventFile, preload };
}

function dispose(root: string): void {
  const actual = realpathSync(root);
  if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
    throw new Error("INFRASTRUCTURE: fixture escaped the temporary directory");
  }
  rmSync(actual, { recursive: true, force: true });
}

function events(file: string): CopyEvent[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as CopyEvent);
}

function launch(root: string, preload: string, driver: string, env: Record<string, string>, withTsx = false): ReturnType<typeof spawnSync> {
  const result = spawnSync(process.execPath, ["--require", preload, ...(withTsx ? ["--import", "tsx"] : []), driver], {
    cwd: ROOT,
    env: { ...process.env, NODE_OPTIONS: "", ...env },
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
  });
  if (result.error || result.signal || /ERR_MODULE_NOT_FOUND|Cannot find package/.test(result.stderr ?? "")) {
    throw new Error(`INFRASTRUCTURE: backup driver could not launch (${result.error?.message ?? result.signal ?? result.stderr?.slice(-600)})`);
  }
  return result;
}

function runDeployBackup(bothCandidates: boolean): { fixture: ReturnType<typeof fixture>; result: ReturnType<typeof spawnSync>; copied: CopyEvent[] } {
  const testData = fixture(bothCandidates);
  mkdirSync(join(testData.root, "scripts", "tooling"), { recursive: true });
  for (const source of ["scripts/tooling/ps-deploy.mjs", "scripts/tooling/_platform.mjs", "scripts/tooling/_env-local.mjs"]) {
    copyFileSync(join(ROOT, source), join(testData.root, source));
  }
  const driver = join(testData.root, "deploy-driver.mjs");
  writeFileSync(driver, `
    const { backupDb } = await import(process.env.ORACLE_DEPLOY_URL);
    if (!backupDb(process.env.PS_DATA_DIR)) process.exitCode = 17;
  `);
  const result = launch(testData.root, testData.preload, driver, {
    PS_DATA_DIR: testData.dataDir,
    HERMES_HOME: testData.hermesHome,
    ORACLE_DEPLOY_URL: pathToFileURL(join(testData.root, "scripts", "tooling", "ps-deploy.mjs")).href,
    ORACLE_COPY_EVENTS: testData.eventFile,
  });
  return { fixture: testData, result, copied: events(testData.eventFile) };
}

function assertInitialModes(copied: CopyEvent[], expectedCount: number): void {
  expect(copied).toHaveLength(expectedCount);
  if (process.platform === "linux") {
    expect(copied.map((event) => event.modeAtCreation)).toEqual(Array(expectedCount).fill(0o600));
  }
}

describe("T-0161 backups cover both candidates and are private at creation", () => {
  it("deploy backs up both existing database candidates and their sidecars", () => {
    const probe = runDeployBackup(true);
    try {
      expect(probe.result.status).toBe(0);
      const names = readdirSync(probe.fixture.dataDir);
      for (const base of ["patterstage.db", "control-hub.db"]) {
        const backups = names.filter((name) => name.startsWith(`${base}.pre-migrate-`) && name.endsWith(".bak"));
        expect(backups).toHaveLength(1);
        for (const suffix of ["", "-wal", "-shm"]) {
          expect(readFileSync(join(probe.fixture.dataDir, `${backups[0]}${suffix}`))).toEqual(readFileSync(join(probe.fixture.dataDir, `${base}${suffix}`)));
        }
      }
    } finally {
      dispose(probe.fixture.root);
    }
  });

  it("deploy backup copies are owner-only immediately after creation", () => {
    const probe = runDeployBackup(false);
    try {
      expect(probe.result.status).toBe(0);
      assertInitialModes(probe.copied, 3);
    } finally {
      dispose(probe.fixture.root);
    }
  });

  it("Node setup backup copies are owner-only immediately after creation", () => {
    const testData = fixture(false);
    try {
      mkdirSync(join(testData.root, "scripts", "bootstrap"), { recursive: true });
      mkdirSync(join(testData.root, "scripts", "tooling"), { recursive: true });
      for (const source of ["scripts/bootstrap/setup.mjs", "scripts/bootstrap/env-local.mjs", "scripts/tooling/_platform.mjs"]) {
        copyFileSync(join(ROOT, source), join(testData.root, source));
      }
      const result = launch(testData.root, testData.preload, join(testData.root, "scripts", "bootstrap", "setup.mjs"), {
        PS_DATA_DIR: testData.dataDir,
        HERMES_HOME: testData.hermesHome,
        PORT: "47327",
        ORACLE_COPY_EVENTS: testData.eventFile,
      });
      expect(result.status).toBe(0);
      assertInitialModes(events(testData.eventFile), 3);
    } finally {
      dispose(testData.root);
    }
  });

  it("baseline rebuild backup is owner-only immediately after creation", () => {
    const testData = fixture(false);
    try {
      const dbPath = join(testData.dataDir, "patterstage.db");
      rmSync(dbPath);
      const db = new DatabaseCtor(dbPath);
      db.exec("CREATE TABLE legacy_fixture (value TEXT)");
      db.close();
      if (process.platform !== "win32") chmodSync(dbPath, 0o644);
      const driver = join(testData.root, "upgrade-driver.mjs");
      writeFileSync(driver, `
        import { createRequire } from 'node:module';
        import { pathToFileURL } from 'node:url';
        const require = createRequire(pathToFileURL(process.env.ORACLE_UPGRADE_PATH));
        const Database = require('better-sqlite3/lib/index.js');
        const { rebuildToBaseline } = await import(pathToFileURL(process.env.ORACLE_UPGRADE_PATH).href);
        const db = new Database(process.env.ORACLE_DB_PATH);
        process.chdir(process.env.ORACLE_ROOT);
        rebuildToBaseline(db, process.env.ORACLE_DB_PATH, 'CREATE TABLE rebuilt_fixture (id TEXT)');
      `);
      const result = launch(testData.root, testData.preload, driver, {
        PS_DATA_DIR: testData.dataDir,
        HERMES_HOME: testData.hermesHome,
        ORACLE_DB_PATH: dbPath,
        ORACLE_ROOT: testData.root,
        ORACLE_UPGRADE_PATH: join(ROOT, "src", "lib", "db", "upgrade.ts"),
        ORACLE_COPY_EVENTS: testData.eventFile,
      }, true);
      if (result.status !== 0) {
        throw new Error(`Baseline rebuild failed before the mode assertion: ${(result.stderr ?? "").slice(-800)}`);
      }
      const copied = events(testData.eventFile);
      expect(copied[0]?.name).toMatch(/^patterstage[.]db[.]pre-baseline-/);
      assertInitialModes(copied, 1);
    } finally {
      dispose(testData.root);
    }
  });
});
