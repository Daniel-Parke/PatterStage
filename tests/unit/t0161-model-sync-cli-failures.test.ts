/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PREFIX = "t0161-model-sync-failure-";
const PRIVATE_MARKER = "fixture-private-config-marker";

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

function run(script: string, preload: string, env: NodeJS.ProcessEnv, tsx = true) {
  return spawnSync(process.execPath, ["--require", preload, ...(tsx ? ["--import", "tsx"] : []), script], {
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

describe("T-0161 explicit Hermes model sync reports finaliser refusal", () => {
  it("exits non-zero without exposing config content when malformed YAML blocks a configured default", () => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const dataDir = join(root, "data");
      const hermesHome = join(root, "hermes");
      const config = join(hermesHome, "config.yaml");
      const preload = join(root, "block-local-env.cjs");
      mkdirSync(dataDir);
      mkdirSync(hermesHome);
      writeFileSync(preload, BLOCK_LOCAL_ENV);
      const env = childEnv(root, dataDir, hermesHome);

      const migration = run("scripts/tooling/migrate-db.ts", preload, env);
      requireLaunch(migration, "disposable migration");
      if (migration.status !== 0 || !existsSync(join(dataDir, "patterstage.db"))) {
        throw new Error(`INFRASTRUCTURE: disposable migration failed (${migration.status})`);
      }

      writeFileSync(config, "model:\n  provider: anthropic\n");
      const noDefault = run("scripts/tooling/ensure-hermes-model-sync.ts", preload, env);
      requireLaunch(noDefault, "no-default control");
      if (noDefault.status !== 0 || !/"reason"\s*:\s*"no model_defaults\.agent"/.test(noDefault.stdout)) {
        throw new Error(`INFRASTRUCTURE: no-default control did not skip successfully (${noDefault.status})`);
      }

      writeFileSync(config, "model:\n  default: anthropic/fixture-model\n  provider: anthropic\n");
      const registry = run("scripts/tooling/hermes-registry-import.mjs", preload, env, false);
      requireLaunch(registry, "model-default fixture import");
      if (registry.status !== 0 || !/1 model\(s\)/.test(registry.stdout)) {
        throw new Error(`INFRASTRUCTURE: fixture model default was not imported (${registry.status})`);
      }
      const validSync = run("scripts/tooling/ensure-hermes-model-sync.ts", preload, env);
      requireLaunch(validSync, "valid model-sync control");
      if (validSync.status !== 0 || !/"skipped"\s*:\s*false/.test(validSync.stdout) ||
          !/"appliedModelDefaults"\s*:\s*true/.test(validSync.stdout)) {
        throw new Error(`INFRASTRUCTURE: valid model-sync control did not apply the default (${validSync.status})`);
      }

      const malformed = `model: [\n# ${PRIVATE_MARKER}\n`;
      writeFileSync(config, malformed);
      const refused = run("scripts/tooling/ensure-hermes-model-sync.ts", preload, env);
      requireLaunch(refused, "malformed-config model sync");
      expect({
        exitedNonZero: refused.status !== 0,
        safeFailure: /\b(config\.yaml|hermes|model)\b/i.test(refused.stderr) &&
          /\b(fail(?:ed|ure)?|parse|refus(?:ed|al)?)\b/i.test(refused.stderr),
        contentLeaked: (refused.stdout + refused.stderr).includes(PRIVATE_MARKER),
        configChanged: readFileSync(config, "utf8") !== malformed,
      }).toEqual({ exitedNonZero: true, safeFailure: true, contentLeaked: false, configChanged: false });
    } finally {
      const actual = realpathSync(root);
      if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
        throw new Error("INFRASTRUCTURE: refusing to remove a fixture outside the temporary directory");
      }
      rmSync(actual, { recursive: true, force: true });
    }
  });
});
