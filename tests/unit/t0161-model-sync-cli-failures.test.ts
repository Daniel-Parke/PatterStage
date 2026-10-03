/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { BLOCK_LOCAL_ENV, isolatedChildEnv, requireLaunch } from "../helpers/t0161-isolated-cli";

const ROOT = join(__dirname, "..", "..");
const PREFIX = "t0161-model-sync-failure-";
const PRIVATE_MARKER = "fixture-private-config-marker";

function run(script: string, preload: string, env: NodeJS.ProcessEnv, tsx = true, args: string[] = []) {
  return spawnSync(process.execPath, ["--require", preload, ...(tsx ? ["--import", "tsx"] : []), script, ...args], {
    cwd: ROOT,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
    windowsHide: true,
  });
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
      const env = isolatedChildEnv(ROOT, root, dataDir, hermesHome);

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

  it("exits non-zero when required Hermes config is missing", () => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const dataDir = join(root, "data");
      const hermesHome = join(root, "hermes");
      const config = join(hermesHome, "config.yaml");
      const preload = join(root, "block-local-env.cjs");
      mkdirSync(dataDir);
      mkdirSync(hermesHome);
      writeFileSync(preload, BLOCK_LOCAL_ENV);
      const env = isolatedChildEnv(ROOT, root, dataDir, hermesHome);
      const migration = run("scripts/tooling/migrate-db.ts", preload, env);
      requireLaunch(migration, "disposable migration");
      if (migration.status !== 0 || !existsSync(join(dataDir, "patterstage.db"))) {
        throw new Error(`INFRASTRUCTURE: disposable migration failed (${migration.status})`);
      }
      writeFileSync(config, "model:\n  provider: anthropic\n");
      const configured = run("scripts/tooling/ensure-hermes-model-sync.ts", preload, env, true, ["--require-config"]);
      requireLaunch(configured, "configured required-model-sync control");
      if (configured.status !== 0 || !/"reason"\s*:\s*"no model_defaults\.agent"/.test(configured.stdout)) {
        throw new Error(`INFRASTRUCTURE: configured control did not reach the model-sync CLI (${configured.status})`);
      }
      rmSync(config);
      if (existsSync(config)) throw new Error("INFRASTRUCTURE: disposable Hermes config was not removed");
      const missing = run("scripts/tooling/ensure-hermes-model-sync.ts", preload, env, true, ["--require-config"]);
      requireLaunch(missing, "missing required Hermes config");
      expect({ exitedNonZero: missing.status !== 0, configRecreated: existsSync(config) })
        .toEqual({ exitedNonZero: true, configRecreated: false });
    } finally {
      const actual = realpathSync(root);
      if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
        throw new Error("INFRASTRUCTURE: refusing to remove a fixture outside the temporary directory");
      }
      rmSync(actual, { recursive: true, force: true });
    }
  });
});
