/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PREFIX = "t0161-required-registry-";

function environment(root: string, dataDir: string, hermesHome: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test", NODE_OPTIONS: "", HOME: root, USERPROFILE: root,
    APPDATA: root, LOCALAPPDATA: root, PS_DATA_DIR: dataDir,
    CH_DATA_DIR: dataDir, CONTROL_HUB_DATA_DIR: dataDir, HERMES_HOME: hermesHome,
  };
  for (const key of ["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL"]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}

function run(script: string, args: string[], env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, ["--import", "tsx", script, ...args], {
    cwd: ROOT, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000, windowsHide: true,
  });
}

function requireCompleted(result: ReturnType<typeof run>, step: string): void {
  if (result.error || result.signal || result.status === null) {
    throw new Error(`INFRASTRUCTURE: ${step} did not complete (${result.error?.message ?? result.signal ?? result.status})`);
  }
}

describe("T-0161 required Hermes registry import", () => {
  it("fails when a configured Hermes config disappears, while optional import may skip", () => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const dataDir = join(root, "data");
      const hermesHome = join(root, "hermes");
      const config = join(hermesHome, "config.yaml");
      const dbPath = join(dataDir, "patterstage.db");
      mkdirSync(dataDir);
      mkdirSync(hermesHome);
      const env = environment(root, dataDir, hermesHome);
      const migration = run("scripts/tooling/migrate-db.ts", [], env);
      requireCompleted(migration, "disposable migration");
      if (migration.status !== 0 || !existsSync(dbPath)) {
        throw new Error(`INFRASTRUCTURE: disposable migration failed (${migration.status})`);
      }

      // Model the race after setup has observed a configured Hermes installation.
      writeFileSync(config, "model:\n  default: anthropic/disposable-model\n  provider: anthropic\n");
      if (!existsSync(config)) throw new Error("INFRASTRUCTURE: config fixture was not created");
      const configured = run("scripts/tooling/hermes-registry-import.mjs", [dbPath, "--require-config"], env);
      requireCompleted(configured, "configured required-import control");
      if (configured.status !== 0 || !/Hermes model import: 1 model/.test(configured.stdout)) {
        throw new Error(`INFRASTRUCTURE: configured required-import control failed (${configured.status})`);
      }
      unlinkSync(config);
      if (existsSync(config)) throw new Error("INFRASTRUCTURE: config fixture was not removed");

      const optional = run("scripts/tooling/hermes-registry-import.mjs", [dbPath], env);
      requireCompleted(optional, "optional import control");
      if (optional.status !== 0 || !existsSync(dbPath)) {
        throw new Error(`INFRASTRUCTURE: optional no-Hermes control failed (${optional.status})`);
      }

      const required = run("scripts/tooling/hermes-registry-import.mjs", [dbPath, "--require-config"], env);
      requireCompleted(required, "required import");
      expect({
        exitedNonZero: required.status !== 0,
        exposedFixture: /disposable-model/.test(required.stdout + required.stderr),
      }).toEqual({ exitedNonZero: true, exposedFixture: false });
    } finally {
      const actual = realpathSync(root);
      if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
        throw new Error("INFRASTRUCTURE: refusing to remove a fixture outside the temporary directory");
      }
      rmSync(actual, { recursive: true, force: true });
    }
  });
});
