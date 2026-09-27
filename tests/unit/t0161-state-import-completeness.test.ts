/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- use the real SQLite driver outside Jest's database mock */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PREFIX = "t0161-state-completeness-";
const DatabaseCtor = require(join(ROOT, "node_modules", "better-sqlite3", "lib", "index.js")) as typeof import("better-sqlite3");

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

function environment(root: string, dataDir: string, hermesHome: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test", NODE_OPTIONS: "", HOME: root, USERPROFILE: root,
    APPDATA: root, LOCALAPPDATA: root, PS_DATA_DIR: dataDir,
    CH_DATA_DIR: dataDir, CONTROL_HUB_DATA_DIR: dataDir, HERMES_HOME: hermesHome,
    ORACLE_LOCAL_ENV: join(ROOT, ".env.local"),
  };
  for (const key of ["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL"]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}

function run(script: string, args: string[], preload: string, env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, ["--require", preload, "--import", "tsx", script, ...args], {
    cwd: ROOT, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000, windowsHide: true,
  });
}

function requireSuccess(result: ReturnType<typeof run>, step: string): void {
  if (result.error || result.signal || result.status !== 0) {
    throw new Error(`INFRASTRUCTURE: ${step} failed (${result.error?.message ?? result.signal ?? result.status})`);
  }
}

describe("T-0161 explicit Hermes state import completeness", () => {
  it("reports a new disk profile after partial import without overwriting existing rows", () => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const dataDir = join(root, "data");
      const hermesHome = join(root, "hermes");
      const dbPath = join(dataDir, "patterstage.db");
      const preload = join(root, "block-local-env.cjs");
      mkdirSync(dataDir);
      mkdirSync(join(hermesHome, "skills", "fixture"), { recursive: true });
      writeFileSync(preload, BLOCK_LOCAL_ENV);
      writeFileSync(join(hermesHome, "config.yaml"), "model:\n  default: anthropic/disposable-model\n  provider: anthropic\n");
      writeFileSync(join(hermesHome, "SOUL.md"), "Preserve existing disposable root.\n");
      writeFileSync(join(hermesHome, "skills", "fixture", "SKILL.md"),
        "---\nname: Fixture\ndescription: Disposable skill\n---\nPreserve existing disposable skill.\n");
      const env = environment(root, dataDir, hermesHome);

      requireSuccess(run("scripts/tooling/migrate-db.ts", [], preload, env), "disposable migration");
      if (!existsSync(dbPath)) throw new Error("INFRASTRUCTURE: migration did not create the disposable database");
      const initial = run("scripts/tooling/import-hermes-state.ts", ["--pull"], preload, env);
      requireSuccess(initial, "initial root and skill import control");
      if (!/"skills"\s*:\s*1/.test(initial.stdout) || !/"root"\s*:\s*true/.test(initial.stdout)) {
        throw new Error("INFRASTRUCTURE: initial control did not import root and skill");
      }
      const complete = run("scripts/tooling/import-hermes-state.ts", [], preload, env);
      requireSuccess(complete, "already-complete import control");
      if (!/"skills"\s*:\s*0/.test(complete.stdout) || !/"profiles"\s*:\s*0/.test(complete.stdout)) {
        throw new Error("INFRASTRUCTURE: already-complete control did not take the expected no-op path");
      }

      const profileRoot = join(hermesHome, "profiles", "new-profile");
      mkdirSync(profileRoot, { recursive: true });
      writeFileSync(join(profileRoot, "config.yaml"), "model:\n  default: anthropic/disposable-model\n  provider: anthropic\n");
      writeFileSync(join(profileRoot, "SOUL.md"), "New disposable profile.\n");
      const db = new DatabaseCtor(dbPath);
      try {
        const before = {
          soul: (db.prepare("SELECT soul_md FROM agent_root WHERE id = 1").get() as { soul_md: string }).soul_md,
          skill: (db.prepare("SELECT content FROM skills WHERE skill_key = 'fixture'").get() as { content: string }).content,
        };
        if (!before.soul.includes("Preserve existing") || !before.skill.includes("Preserve existing")) {
          throw new Error("INFRASTRUCTURE: initial import rows were not populated");
        }

        const incomplete = run("scripts/tooling/import-hermes-state.ts", [], preload, env);
        if (incomplete.error || incomplete.signal || incomplete.status === null) {
          throw new Error(`INFRASTRUCTURE: partial import did not complete (${incomplete.error?.message ?? incomplete.signal ?? incomplete.status})`);
        }
        const after = {
          soul: (db.prepare("SELECT soul_md FROM agent_root WHERE id = 1").get() as { soul_md: string }).soul_md,
          skill: (db.prepare("SELECT content FROM skills WHERE skill_key = 'fixture'").get() as { content: string }).content,
          profiles: (db.prepare("SELECT COUNT(*) AS n FROM agent_profiles WHERE slug = 'new-profile'").get() as { n: number }).n,
        };
        if (after.soul !== before.soul || after.skill !== before.skill || after.profiles !== 0) {
          throw new Error("INFRASTRUCTURE: partial-import fixture unexpectedly changed existing data");
        }

        const forced = run("scripts/tooling/import-hermes-state.ts", ["--pull"], preload, env);
        requireSuccess(forced, "explicit pull control");
        const importedProfiles = (db.prepare("SELECT COUNT(*) AS n FROM agent_profiles WHERE slug = 'new-profile'").get() as { n: number }).n;
        if (importedProfiles !== 1 || !/"profiles"\s*:\s*1/.test(forced.stdout)) {
          throw new Error("INFRASTRUCTURE: explicit pull did not import the new profile");
        }

        expect({ exitedNonZero: incomplete.status !== 0, preserved: after.soul === before.soul && after.skill === before.skill })
          .toEqual({ exitedNonZero: true, preserved: true });
      } finally {
        db.close();
      }
    } finally {
      const actual = realpathSync(root);
      if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
        throw new Error("INFRASTRUCTURE: refusing to remove a fixture outside the temporary directory");
      }
      rmSync(actual, { recursive: true, force: true });
    }
  });
});
