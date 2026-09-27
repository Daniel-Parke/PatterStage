/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PREFIX = "t0161-hermes-state-failure-";

const BLOCK_LOCAL_ENV = String.raw`
  const fs = require('node:fs');
  const path = require('node:path');
  const original = fs.existsSync;
  fs.existsSync = function (candidate) {
    if (typeof candidate === 'string' && path.resolve(candidate) === process.env.ORACLE_LOCAL_ENV) return false;
    return original.apply(this, arguments);
  };
  require('node:module').syncBuiltinESMExports();
`;

function childEnv(root: string, dataDir: string, hermesHome: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    NODE_OPTIONS: "",
    HOME: root,
    USERPROFILE: root,
    APPDATA: root,
    LOCALAPPDATA: root,
    PS_DATA_DIR: dataDir,
    CH_DATA_DIR: dataDir,
    CONTROL_HUB_DATA_DIR: dataDir,
    HERMES_HOME: hermesHome,
    ORACLE_LOCAL_ENV: join(ROOT, ".env.local"),
  };
  for (const key of ["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL"]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}

function run(script: string, args: string[], preload: string, env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, ["--require", preload, "--import", "tsx", script, ...args], {
    cwd: ROOT,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
    windowsHide: true,
  });
}

function requireLaunch(result: ReturnType<typeof run>, step: string): void {
  if (result.error || result.signal || result.status === null) {
    throw new Error(`INFRASTRUCTURE: ${step} did not complete (${result.error?.message ?? result.signal ?? result.status})`);
  }
}

describe("T-0161 explicit Hermes state import reports a failed root pull", () => {
  it("exits non-zero with a safe message while no-config and already-imported runs succeed", () => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const dataDir = join(root, "data");
      const hermesHome = join(root, "hermes");
      const preload = join(root, "block-local-env.cjs");
      mkdirSync(dataDir);
      mkdirSync(hermesHome);
      writeFileSync(preload, BLOCK_LOCAL_ENV);
      const env = childEnv(root, dataDir, hermesHome);

      const migration = run("scripts/tooling/migrate-db.ts", [], preload, env);
      requireLaunch(migration, "disposable migration");
      if (migration.status !== 0 || !existsSync(join(dataDir, "patterstage.db"))) {
        throw new Error(`INFRASTRUCTURE: disposable migration failed (${migration.status})`);
      }
      const noConfig = run("scripts/tooling/import-hermes-state.ts", [], preload, env);
      requireLaunch(noConfig, "no-config control");
      if (noConfig.status !== 0 || !/"root"\s*:\s*true/.test(noConfig.stdout)) {
        throw new Error(`INFRASTRUCTURE: no-config control did not succeed (${noConfig.status})`);
      }

      writeFileSync(join(hermesHome, "config.yaml"), "model:\n  default: anthropic/fixture-model\n  provider: anthropic\n");
      const soulPath = join(hermesHome, "SOUL.md");
      writeFileSync(soulPath, "Disposable root content for the import control.\n");
      const skillDir = join(hermesHome, "skills", "fixture");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "SKILL.md"), "---\nname: Fixture\ndescription: Disposable skill\n---\nFixture content.\n");
      const firstImport = run("scripts/tooling/import-hermes-state.ts", ["--pull"], preload, env);
      requireLaunch(firstImport, "valid import control");
      if (firstImport.status !== 0 || !/"root"\s*:\s*true/.test(firstImport.stdout) || !/"skills"\s*:\s*1/.test(firstImport.stdout)) {
        throw new Error(`INFRASTRUCTURE: valid import did not populate root and skill (${firstImport.status})`);
      }
      const alreadyImported = run("scripts/tooling/import-hermes-state.ts", [], preload, env);
      requireLaunch(alreadyImported, "already-imported control");
      if (alreadyImported.status !== 0 || !/"root"\s*:\s*true/.test(alreadyImported.stdout) || !/"skills"\s*:\s*0/.test(alreadyImported.stdout)) {
        throw new Error(`INFRASTRUCTURE: already-imported control did not succeed (${alreadyImported.status})`);
      }

      rmSync(soulPath);
      mkdirSync(join(hermesHome, "SOUL.md"));
      const failedPull = run("scripts/tooling/import-hermes-state.ts", ["--pull"], preload, env);
      requireLaunch(failedPull, "root-pull fixture");
      expect({
        rootFailed: /"root"\s*:\s*false/.test(failedPull.stdout),
        exitedNonZero: failedPull.status !== 0,
        safeFailure: /\b(hermes|root|state|import)\b/i.test(failedPull.stderr) &&
          /\b(fail(?:ed|ure)?|unable|could not)\b/i.test(failedPull.stderr),
        stackTrace: /\n\s+at\s+\S+/.test(failedPull.stderr),
      }).toEqual({ rootFailed: true, exitedNonZero: true, safeFailure: true, stackTrace: false });
    } finally {
      const actual = realpathSync(root);
      if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
        throw new Error("INFRASTRUCTURE: refusing to remove a fixture outside the temporary directory");
      }
      rmSync(actual, { recursive: true, force: true });
    }
  });
});
