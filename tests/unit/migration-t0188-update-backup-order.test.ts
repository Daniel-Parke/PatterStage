/** @jest-environment node */
// Synthetic CLI ordering controls. External commands are intercepted; backup filesystem work is real.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { RealDb } from "../helpers/baseline-db";

const ROOT = join(__dirname, "..", "..");
const SQLITE_MODULE = join(ROOT, "node_modules", "better-sqlite3", "lib", "index.js");
const Database = jest.requireActual(SQLITE_MODULE) as new (path: string, options?: { readonly: boolean; fileMustExist: boolean }) => RealDb;
type Snapshot = { schema: unknown[]; version: unknown; rows: unknown[] };
type Event = { step: string; inspected?: boolean; error?: string };
function snapshot(db: RealDb): Snapshot {
  return {
    schema: db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name").all(),
    version: db.prepare("SELECT value FROM meta WHERE key='schema_version'").get(),
    rows: db.prepare("SELECT id,name,prompt FROM missions ORDER BY id").all(),
  };
}

// Adapted from the frozen T-0161 child-command boundary. No backup function is mocked.
const PRELOAD = String.raw`
  const cp = require('node:child_process');
  const fs = require('node:fs');
  const path = require('node:path');
  const Database = require(process.env.ORACLE_SQLITE_MODULE);
  const expected = JSON.parse(fs.readFileSync(process.env.ORACLE_EXPECTED, 'utf8'));
  const log = event => fs.appendFileSync(process.env.ORACLE_EVENTS, JSON.stringify(event) + '\n');
  const migrationsSeen = new Set();
  const backupPath = destination => /[.]pre-migrate-/.test(String(destination));
  if (process.env.ORACLE_MODE === 'backup-failure') {
    for (const method of ['copyFileSync', 'openSync']) {
      const original = fs[method];
      fs[method] = (...args) => {
        if (backupPath(method === 'copyFileSync' ? args[1] : args[0])) {
          log({step:'backup-failure'});
          const error = new Error('owned deterministic backup failure');
          error.code = 'EACCES';
          throw error;
        }
        return original(...args);
      };
    }
  }
  const inspect = () => {
    const names = fs.readdirSync(process.env.PS_DATA_DIR)
      .filter(name => /^patterstage[.]db[.]pre-migrate-.*[.]bak$/.test(name));
    if (names.length !== 1) return {inspected:false,error:'expected exactly one completed backup'};
    let db;
    try {
      db = new Database(path.join(process.env.PS_DATA_DIR,names[0]), {readonly:true,fileMustExist:true});
      const integrity = db.pragma('integrity_check', {simple:true});
      const actual = {
        schema: db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name').all(),
        version: db.prepare("SELECT value FROM meta WHERE key='schema_version'").get(),
        rows: db.prepare('SELECT id,name,prompt FROM missions ORDER BY id').all(),
      };
      return {inspected:integrity === 'ok' && JSON.stringify(actual) === JSON.stringify(expected)};
    } catch (error) { return {inspected:false,error:String(error)}; }
    finally { if (db) db.close(); }
  };
  cp.spawnSync = (command,args=[]) => {
    const call = [command,...args].join(' ');
    const step = call.includes('migrate-to-runtime.mjs') ? 'legacy'
      : call.includes('db:migrate') || call.includes('migrate-db.ts') ? 'schema'
      : call.includes('hermes-registry-import.mjs') ? 'registry'
      : call.includes('import-hermes-state.ts') ? 'hermes-state'
      : call.includes('seed-catalog.ts') ? 'catalog'
      : call.includes('ensure-hermes-model-sync.ts') ? 'model-sync' : 'other';
    if (step === 'legacy' || step === 'schema') {
      const inspection = inspect();
      log({step,...inspection});
      if (!inspection.inspected) return {status:23,stdout:'',stderr:'backup inspection failed at migration entry'};
      const live = new Database(path.join(process.env.PS_DATA_DIR,'patterstage.db'));
      try { live.exec("UPDATE missions SET prompt='changed-at-migration-entry' WHERE id='owned'"); }
      finally { live.close(); }
      if (process.env.ORACLE_MODE === 'migration-failure') return {status:17,stdout:'',stderr:'owned migration failure'};
      migrationsSeen.add(step);
      if (process.env.ORACLE_MODE === 'boundary-stop' && migrationsSeen.size === 2) {
        log({step:'owned-boundary-complete'});
        return {status:31,stdout:'',stderr:'owned ordering boundary complete; full updater is out of scope'};
      }
    } else log({step});
    return {status:0,stdout:'',stderr:''};
  };
  for (const method of ['spawn','exec','execSync','execFile','execFileSync','fork']) {
    cp[method] = () => { throw new Error('INFRASTRUCTURE: unowned external command boundary ' + method); };
  }
  require('node:module').syncBuiltinESMExports();
`;

function fixture(action: string, mode: string) {
  const parent = process.env.PS_DATA_DIR;
  if (!parent) throw new Error("INFRASTRUCTURE: owned PS_DATA_DIR must be set before module loading");
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, "t0188-updater-"));
  const data = join(root, "data");
  const hermes = join(root, "hermes");
  const eventFile = join(root, "events.jsonl");
  const statusFile = join(root, "deploy.status");
  const preload = join(root, "preload.cjs");
  mkdirSync(data);
  mkdirSync(hermes);
  mkdirSync(join(root, "scripts", "tooling"), { recursive: true });
  for (const source of ["ps-deploy.mjs", "_platform.mjs", "_env-local.mjs", "network-boundary.mjs"]) {
    copyFileSync(join(ROOT, "scripts", "tooling", source), join(root, "scripts", "tooling", source));
  }
  writeFileSync(join(hermes, "config.yaml"), "model: fixture-only\n");
  const db = new Database(join(data, "patterstage.db"));
  let original: Snapshot;
  try {
    db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY,value TEXT NOT NULL)");
    db.exec(readFileSync(join(ROOT, "src", "lib", "db", "migrations", "001_baseline.sql"), "utf8"));
    db.exec("INSERT INTO meta VALUES ('schema_version','3'); INSERT INTO missions (id,name,prompt) VALUES ('owned','User mission','original prompt')");
    original = snapshot(db);
  } finally { db.close(); }
  const expectedFile = join(root, "expected.json");
  writeFileSync(expectedFile, JSON.stringify(original));
  writeFileSync(preload, PRELOAD);
  const result = spawnSync(process.execPath, ["--require", preload, realpathSync(join(root, "scripts", "tooling", "ps-deploy.mjs")), action], {
    cwd: root,
    env: {
      NODE_ENV: "test",
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      ComSpec: process.env.ComSpec,
      TEMP: root,
      TMP: root,
      TMPDIR: root,
      NODE_OPTIONS: "",
      PS_DATA_DIR: data,
      CH_DATA_DIR: data,
      HERMES_HOME: hermes,
      PS_DEPLOY_STATUS_FILE: statusFile,
      ORACLE_SQLITE_MODULE: SQLITE_MODULE,
      ORACLE_EVENTS: eventFile,
      ORACLE_EXPECTED: expectedFile,
      ORACLE_MODE: mode,
    },
    encoding: "utf8", timeout: 30_000, windowsHide: true,
  });
  const events: Event[] = existsSync(eventFile)
    ? readFileSync(eventFile, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as Event) : [];
  const status = existsSync(statusFile) ? readFileSync(statusFile, "utf8") : "";
  const receiptDirectory = process.env.T0188_ORACLE_RECEIPTS;
  if (receiptDirectory) {
    mkdirSync(receiptDirectory, { recursive: true });
    writeFileSync(join(receiptDirectory, `${action}-${mode}.json`), JSON.stringify({
      action, mode, exitCode: result.status, events, status,
      stdout: result.stdout, stderr: result.stderr,
    }, null, 2));
  }
  const dispose = () => {
    if (dirname(realpathSync(root)) !== realpathSync(parent)) throw new Error("INFRASTRUCTURE: updater fixture escaped owned data");
    rmSync(root, { recursive: true, force: true });
  };
  if (result.error || result.signal || /INFRASTRUCTURE:|ERR_MODULE_NOT_FOUND|Cannot find package/.test(result.stderr ?? "")) {
    dispose();
    throw new Error(`INFRASTRUCTURE: public updater launch/instrumentation failed: ${result.error?.message ?? result.signal ?? result.stderr}`);
  }
  return { data, original, result, events, status, dispose };
}

describe("T-0188 synthetic public updater backup ordering", () => {
  it.each(["update", "rebuild"])("%s has a complete readable pre-upgrade backup at each migration-command entry", (action) => {
    const probe = fixture(action, "boundary-stop");
    try {
      const migration = probe.events.filter((event) => ["legacy", "schema"].includes(event.step));
      expect(migration.map((event) => event.step).sort()).toEqual(["legacy", "schema"]);
      expect(migration.every((event) => event.inspected === true)).toBe(true);
      expect(probe.events.some((event) => event.step === "owned-boundary-complete")).toBe(true);
      expect(probe.result.status).not.toBe(0);
      expect(probe.status).toMatch(/^state=failed$/m);
      expect(probe.status).toMatch(/^phase=migrate$/m);
      const backups = readdirSync(probe.data).filter((name) => /^patterstage[.]db[.]pre-migrate-.*[.]bak$/.test(name));
      expect(backups).toHaveLength(1);
      const backup = new Database(join(probe.data, backups[0]), { readonly: true, fileMustExist: true });
      try { expect(snapshot(backup)).toEqual(probe.original); } finally { backup.close(); }
      const live = new Database(join(probe.data, "patterstage.db"), { readonly: true, fileMustExist: true });
      try {
        expect(live.prepare("SELECT prompt FROM missions WHERE id='owned'").get())
          .toEqual({ prompt: "changed-at-migration-entry" });
      } finally { live.close(); }
    } finally { probe.dispose(); }
  });

  it.each(["update", "rebuild"])("%s backup failure prevents migration and imports", (action) => {
    const probe = fixture(action, "backup-failure");
    try {
      expect(probe.events.some((event) => event.step === "backup-failure")).toBe(true);
      expect(probe.result.status).not.toBe(0);
      expect(probe.status).toMatch(/^state=failed$/m);
      expect(probe.events.filter((event) => ["legacy", "schema", "registry", "hermes-state", "catalog", "model-sync"].includes(event.step)))
        .toEqual([]);
      const live = new Database(join(probe.data, "patterstage.db"), { readonly: true, fileMustExist: true });
      try { expect(snapshot(live)).toEqual(probe.original); } finally { live.close(); }
    } finally { probe.dispose(); }
  });

  it.each(["update", "rebuild"])("%s migration failure retains the inspected backup and stops later required work", (action) => {
    const probe = fixture(action, "migration-failure");
    try {
      const migration = probe.events.findIndex((event) => ["legacy", "schema"].includes(event.step));
      expect(migration).toBeGreaterThanOrEqual(0);
      expect(probe.events[migration]?.inspected).toBe(true);
      expect(probe.result.status).not.toBe(0);
      expect(probe.status).toMatch(/^state=failed$/m);
      expect(probe.status).not.toMatch(/^state=complete$/m);
      expect(probe.events.slice(migration + 1).filter((event) => ["legacy", "schema", "registry", "hermes-state", "catalog", "model-sync"].includes(event.step)))
        .toEqual([]);
      const backups = readdirSync(probe.data).filter((name) => /^patterstage[.]db[.]pre-migrate-.*[.]bak$/.test(name));
      expect(backups).toHaveLength(1);
      const backup = new Database(join(probe.data, backups[0]), { readonly: true, fileMustExist: true });
      try { expect(snapshot(backup)).toEqual(probe.original); } finally { backup.close(); }
    } finally { probe.dispose(); }
  });
});
