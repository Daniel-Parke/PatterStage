/** @jest-environment node */

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { isolatedChildEnv, requireLaunch, runCli } from "../helpers/t0161-isolated-cli";

const ROOT = join(__dirname, "..", "..");
const SOURCE_MANIFEST = join(ROOT, "data", "seed", "profiles", "manifest.json");
const PREFIX = "t0161-catalog-failure-";

const FIXTURE_PRELOAD = String.raw`
  const fs = require('node:fs');
  const path = require('node:path');
  const originalExists = fs.existsSync;
  const originalRead = fs.readFileSync;
  fs.existsSync = function (candidate) {
    if (typeof candidate === 'string' && path.resolve(candidate) === process.env.ORACLE_LOCAL_ENV) return false;
    return originalExists.apply(this, arguments);
  };
  fs.readFileSync = function (candidate, ...args) {
    if (typeof candidate === 'string' && path.resolve(candidate) === process.env.ORACLE_SOURCE_MANIFEST) {
      fs.appendFileSync(process.env.ORACLE_EVENTS, 'profiles-manifest\n');
      return originalRead.call(this, process.env.ORACLE_FIXTURE_MANIFEST, ...args);
    }
    return originalRead.call(this, candidate, ...args);
  };
  require('node:module').syncBuiltinESMExports();
`;

function run(script: string, args: string[], preload: string, env: NodeJS.ProcessEnv) {
  return runCli(ROOT, script, args, preload, env);
}

describe("T-0161 explicit catalog seed reports a module failure", () => {
  it("exits non-zero when the profiles manifest is malformed in a disposable fixture", () => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const dataDir = join(root, "data");
      const hermesHome = join(root, "hermes");
      const preload = join(root, "manifest-preload.cjs");
      const goodManifest = join(root, "profiles-valid.json");
      const badManifest = join(root, "profiles-invalid.json");
      const goodEvents = join(root, "valid-events.txt");
      const badEvents = join(root, "invalid-events.txt");
      mkdirSync(dataDir);
      mkdirSync(hermesHome);
      copyFileSync(SOURCE_MANIFEST, goodManifest);
      writeFileSync(badManifest, "{ malformed profiles manifest\n");
      writeFileSync(preload, FIXTURE_PRELOAD);
      const env = isolatedChildEnv(ROOT, root, dataDir, hermesHome, SOURCE_MANIFEST);

      const migration = run("scripts/tooling/migrate-db.ts", [], preload, env);
      requireLaunch(migration, "disposable migration");
      if (migration.status !== 0 || !existsSync(join(dataDir, "patterstage.db"))) {
        throw new Error(`INFRASTRUCTURE: disposable migration failed (${migration.status})`);
      }

      const valid = run("scripts/tooling/seed-catalog.ts", ["--merge"], preload, {
        ...env, ORACLE_FIXTURE_MANIFEST: goodManifest, ORACLE_EVENTS: goodEvents,
      });
      requireLaunch(valid, "valid catalog control");
      if (valid.status !== 0 || !existsSync(goodEvents) || !readFileSync(goodEvents, "utf8").includes("profiles-manifest") ||
          !/"profiles"\s*:\s*[1-9]/.test(valid.stdout)) {
        throw new Error(`INFRASTRUCTURE: valid catalog control did not seed through the profiles manifest (${valid.status})`);
      }

      const invalid = run("scripts/tooling/seed-catalog.ts", ["--merge"], preload, {
        ...env, ORACLE_FIXTURE_MANIFEST: badManifest, ORACLE_EVENTS: badEvents,
      });
      requireLaunch(invalid, "malformed-manifest catalog fixture");
      if (!existsSync(badEvents) || !readFileSync(badEvents, "utf8").includes("profiles-manifest")) {
        throw new Error("INFRASTRUCTURE: malformed manifest did not reach the module seed");
      }
      expect({
        exitedNonZero: invalid.status !== 0,
        corruptedCanonicalManifest: readFileSync(SOURCE_MANIFEST, "utf8") !== readFileSync(goodManifest, "utf8"),
      }).toEqual({ exitedNonZero: true, corruptedCanonicalManifest: false });
    } finally {
      const actual = realpathSync(root);
      if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
        throw new Error("INFRASTRUCTURE: refusing to remove a fixture outside the temporary directory");
      }
      rmSync(actual, { recursive: true, force: true });
    }
  });
});
