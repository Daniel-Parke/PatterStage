/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const SOURCE_MANIFEST = join(ROOT, "data", "seed", "profiles", "manifest.json");
const PREFIX = "t0161-profiles-manifest-";

const PRELOAD = String.raw`
  const fs = require('node:fs');
  const path = require('node:path');
  const originalExists = fs.existsSync;
  const originalRead = fs.readFileSync;
  fs.existsSync = function (candidate) {
    if (typeof candidate === 'string' && path.resolve(candidate) === process.env.ORACLE_LOCAL_ENV) return false;
    if (typeof candidate === 'string' && path.resolve(candidate) === process.env.ORACLE_SOURCE_MANIFEST) {
      fs.appendFileSync(process.env.ORACLE_EVENTS, 'exists\n');
      return process.env.ORACLE_VARIANT !== 'missing';
    }
    return originalExists.apply(this, arguments);
  };
  fs.readFileSync = function (candidate, ...args) {
    if (typeof candidate === 'string' && path.resolve(candidate) === process.env.ORACLE_SOURCE_MANIFEST) {
      fs.appendFileSync(process.env.ORACLE_EVENTS, 'read\n');
      return originalRead.call(this, process.env.ORACLE_FIXTURE_MANIFEST, ...args);
    }
    return originalRead.call(this, candidate, ...args);
  };
  require('node:module').syncBuiltinESMExports();
`;

function run(script: string, preload: string, env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, ["--require", preload, "--import", "tsx", script, ...(script.endsWith("seed-catalog.ts") ? ["--merge"] : [])], {
    cwd: ROOT, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000, windowsHide: true,
  });
}

function requireLaunch(result: ReturnType<typeof run>, step: string): void {
  if (result.error || result.signal || result.status === null) {
    throw new Error(`INFRASTRUCTURE: ${step} did not complete (${result.error?.message ?? result.signal ?? result.status})`);
  }
}

describe("T-0161 explicit seed requires the bundled profiles manifest", () => {
  it("exits non-zero when the Hermes profiles manifest is missing", () => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const dataDir = join(root, "data");
      const hermesHome = join(root, "hermes");
      const preload = join(root, "manifest-preload.cjs");
      const fixtureManifest = join(root, "profiles-valid.json");
      const controlEvents = join(root, "control-events.txt");
      const failureEvents = join(root, "failure-events.txt");
      mkdirSync(dataDir);
      mkdirSync(hermesHome);
      copyFileSync(SOURCE_MANIFEST, fixtureManifest);
      writeFileSync(preload, PRELOAD);
      const env: NodeJS.ProcessEnv = {
        NODE_ENV: "test", NODE_OPTIONS: "", HOME: root, USERPROFILE: root, APPDATA: root, LOCALAPPDATA: root,
        PS_DATA_DIR: dataDir, CH_DATA_DIR: dataDir, CONTROL_HUB_DATA_DIR: dataDir, HERMES_HOME: hermesHome,
        ORACLE_LOCAL_ENV: join(ROOT, ".env.local"), ORACLE_SOURCE_MANIFEST: SOURCE_MANIFEST,
        ORACLE_FIXTURE_MANIFEST: fixtureManifest,
      };
      for (const key of ["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL"]) {
        if (process.env[key] !== undefined) env[key] = process.env[key];
      }

      const migration = run("scripts/tooling/migrate-db.ts", preload, { ...env, ORACLE_VARIANT: "valid", ORACLE_EVENTS: controlEvents });
      requireLaunch(migration, "disposable migration");
      if (migration.status !== 0 || !existsSync(join(dataDir, "patterstage.db"))) {
        throw new Error(`INFRASTRUCTURE: disposable migration failed (${migration.status})`);
      }
      const control = run("scripts/tooling/seed-catalog.ts", preload, { ...env, ORACLE_VARIANT: "valid", ORACLE_EVENTS: controlEvents });
      requireLaunch(control, "valid profiles control");
      if (control.status !== 0 || !existsSync(controlEvents) ||
          !readFileSync(controlEvents, "utf8").includes("read") || !/"profiles"\s*:\s*[1-9]/.test(control.stdout)) {
        throw new Error(`INFRASTRUCTURE: no-Hermes control did not seed profiles (${control.status})`);
      }

      const missing = run("scripts/tooling/seed-catalog.ts", preload, { ...env, ORACLE_VARIANT: "missing", ORACLE_EVENTS: failureEvents });
      requireLaunch(missing, "missing profiles manifest fixture");
      const events = existsSync(failureEvents) ? readFileSync(failureEvents, "utf8").trim().split("\n") : [];
      if (!events.includes("exists") || events.includes("read")) {
        throw new Error("INFRASTRUCTURE: missing fixture did not reach the Hermes profiles manifest check");
      }
      expect({ exitedNonZero: missing.status !== 0, canonicalChanged: readFileSync(SOURCE_MANIFEST, "utf8") !== readFileSync(fixtureManifest, "utf8") })
        .toEqual({ exitedNonZero: true, canonicalChanged: false });
    } finally {
      const actual = realpathSync(root);
      if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
        throw new Error("INFRASTRUCTURE: refusing to remove a fixture outside the temporary directory");
      }
      rmSync(actual, { recursive: true, force: true });
    }
  });
});
