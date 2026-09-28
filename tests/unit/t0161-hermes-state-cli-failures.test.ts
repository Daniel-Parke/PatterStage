/** @jest-environment node */

import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { BLOCK_LOCAL_ENV, isolatedChildEnv, requireLaunch, runCli } from "../helpers/t0161-isolated-cli";

const ROOT = join(__dirname, "..", "..");
const PREFIX = "t0161-hermes-state-failure-";

function run(script: string, args: string[], preload: string, env: NodeJS.ProcessEnv) {
  return runCli(ROOT, script, args, preload, env);
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
      const env = isolatedChildEnv(ROOT, root, dataDir, hermesHome);

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
