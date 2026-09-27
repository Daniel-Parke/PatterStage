/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- use the real SQLite driver outside Jest's database mock */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PREFIX = "t0161-discovery-error-";
const DatabaseCtor = require(join(ROOT, "node_modules", "better-sqlite3", "lib", "index.js")) as typeof import("better-sqlite3");
const PRIVATE_MARKER = "PRIVATE_DISPOSABLE_FIXTURE_CONTENT";

const FAULT_PRELOAD = String.raw`
  const fs = require('node:fs');
  const path = require('node:path');
  const originalExists = fs.existsSync;
  const originalStat = fs.statSync;
  fs.existsSync = function (candidate) {
    if (typeof candidate === 'string' && path.resolve(candidate) === process.env.ORACLE_LOCAL_ENV) return false;
    return originalExists.apply(this, arguments);
  };
  fs.statSync = function (candidate, ...args) {
    if (process.env.ORACLE_FAULT_PATH && typeof candidate === 'string' &&
        path.resolve(candidate) === process.env.ORACLE_FAULT_PATH) {
      fs.appendFileSync(process.env.ORACLE_EVENTS, 'stat-fault\n');
      const error = new Error('EACCES: disposable discovery fixture');
      error.code = 'EACCES';
      throw error;
    }
    return originalStat.call(this, candidate, ...args);
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

describe("T-0161 explicit Hermes discovery errors", () => {
  it.each(["profile", "skill"] as const)("fails closed when %s stat reports EACCES", (kind) => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const dataDir = join(root, "data");
      const hermesHome = join(root, "hermes");
      const dbPath = join(dataDir, "patterstage.db");
      const preload = join(root, "fault-preload.cjs");
      const events = join(root, "events.txt");
      const target = kind === "profile"
        ? join(hermesHome, "profiles", "disposable-profile")
        : join(hermesHome, "skills", "disposable-skill");
      mkdirSync(dataDir);
      mkdirSync(target, { recursive: true });
      writeFileSync(preload, FAULT_PRELOAD);
      writeFileSync(join(hermesHome, "config.yaml"), "model:\n  default: anthropic/disposable-model\n  provider: anthropic\n");
      writeFileSync(join(hermesHome, "SOUL.md"), "Disposable root.\n");
      if (kind === "profile") {
        writeFileSync(join(target, "config.yaml"), "model:\n  default: anthropic/disposable-model\n  provider: anthropic\n");
        writeFileSync(join(target, "SOUL.md"), PRIVATE_MARKER + "\n");
      } else {
        writeFileSync(join(target, "SKILL.md"),
          "---\nname: Disposable Skill\ndescription: Fixture\n---\n" + PRIVATE_MARKER + "\n");
      }
      const env = environment(root, dataDir, hermesHome);
      requireSuccess(run("scripts/tooling/migrate-db.ts", [], preload, env), "disposable migration");
      if (!existsSync(dbPath)) throw new Error("INFRASTRUCTURE: migration did not create the disposable database");

      const control = run("scripts/tooling/import-hermes-state.ts", ["--pull"], preload, env);
      requireSuccess(control, "unfaulted explicit import control");
      if (!new RegExp(`"${kind === "profile" ? "profiles" : "skills"}"\\s*:\\s*1`).test(control.stdout)) {
        throw new Error(`INFRASTRUCTURE: unfaulted ${kind} control did not import the fixture`);
      }
      const db = new DatabaseCtor(dbPath);
      try {
        const table = kind === "profile" ? "agent_profiles" : "skills";
        const key = kind === "profile" ? "slug" : "skill_key";
        const value = kind === "profile" ? "disposable-profile" : "disposable-skill";
        const count = () => (db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${key} = ?`).get(value) as { n: number }).n;
        if (count() !== 1) throw new Error(`INFRASTRUCTURE: ${kind} control did not write a database row`);
        db.prepare(`DELETE FROM ${table} WHERE ${key} = ?`).run(value);
        if (count() !== 0) throw new Error(`INFRASTRUCTURE: ${kind} row could not be reset for the faulted import`);

        const faulted = run("scripts/tooling/import-hermes-state.ts", ["--pull"], preload, {
          ...env, ORACLE_FAULT_PATH: realpathSync(target), ORACLE_EVENTS: events,
        });
        if (faulted.error || faulted.signal || faulted.status === null) {
          throw new Error(`INFRASTRUCTURE: faulted ${kind} import did not complete (${faulted.error?.message ?? faulted.signal ?? faulted.status})`);
        }
        if (!existsSync(events) || !readFileSync(events, "utf8").includes("stat-fault")) {
          throw new Error(`INFRASTRUCTURE: ${kind} stat fault was not injected`);
        }

        expect({
          exitedNonZero: faulted.status !== 0,
          missingRow: count() === 0,
          exposedContent: (faulted.stdout + faulted.stderr).includes(PRIVATE_MARKER),
        }).toEqual({ exitedNonZero: true, missingRow: true, exposedContent: false });
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
