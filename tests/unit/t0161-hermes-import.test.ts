/** @jest-environment node */
/* load the real SQLite driver outside Jest's database mock */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const CLI = join(ROOT, "scripts", "tooling", "hermes-registry-import.mjs");
const PREFIX = "t0161-hermes-import-";
const MODEL_ID = "anthropic/claude-sonnet-4";
const FICTIONAL_KEY = "fictional-t0161-only-key";

type RealDb = import("better-sqlite3").Database;
const DatabaseCtor = require(join(ROOT, "node_modules", "better-sqlite3", "lib", "index.js")) as new (path: string) => RealDb;

function isolatedEnvironment(root: string, dataDir: string, hermesHome: string): NodeJS.ProcessEnv {
  const allowed = new Set([
    "PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "TMPDIR",
    "OS", "PROCESSOR_ARCHITECTURE", "NUMBER_OF_PROCESSORS", "PROGRAMFILES",
    "PROGRAMFILES(X86)", "COMMONPROGRAMFILES", "LANG", "LC_ALL",
    "USERNAME", "USERDOMAIN", "HOMEDRIVE", "HOMEPATH",
  ]);
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test" };
  for (const [key, value] of Object.entries(process.env)) {
    if (allowed.has(key.toUpperCase())) env[key] = value;
  }
  return {
    ...env,
    HOME: root,
    USERPROFILE: process.env.USERPROFILE ?? root,
    APPDATA: root,
    LOCALAPPDATA: root,
    npm_config_cache: join(root, "npm-cache"),
    EOS_SESSION_ID: "T-0161-safety-oracle",
    PS_DATA_DIR: dataDir,
    CH_DATA_DIR: join(root, "legacy-data"),
    HERMES_HOME: hermesHome,
  };
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return spawnSync(command, args, {
    cwd: ROOT,
    env,
    shell: process.platform === "win32" && command.endsWith(".cmd"),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 90_000,
    windowsHide: true,
  });
}

function withMigratedFixture(config: string, check: (dataDir: string, env: NodeJS.ProcessEnv) => void): void {
  const root = mkdtempSync(join(tmpdir(), PREFIX));
  const dataDir = join(root, "data");
  const hermesHome = join(root, "hermes");
  try {
    mkdirSync(dataDir);
    mkdirSync(hermesHome);
    mkdirSync(join(root, "legacy-data"));
    const env = isolatedEnvironment(root, dataDir, hermesHome);
    const migrate = run(process.execPath, ["--import", "tsx", "scripts/tooling/migrate-db.ts"], env);
    if (migrate.error || migrate.status !== 0) {
      const diagnostic = `${migrate.stderr ?? ""}\n${migrate.stdout ?? ""}`
        .replaceAll(root, "<fixture>")
        .replaceAll(FICTIONAL_KEY, "<fixture-key>")
        .slice(-1200);
      throw new Error(`INFRASTRUCTURE: disposable database migration failed (${migrate.error?.message ?? migrate.signal ?? migrate.status}): ${diagnostic}`);
    }
    const dbPath = join(dataDir, "patterstage.db");
    if (!existsSync(dbPath)) throw new Error("INFRASTRUCTURE: migration did not create the disposable database");
    const db = new DatabaseCtor(dbPath);
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('models', 'model_defaults', 'credentials')").all() as Array<{ name: string }>;
      if (tables.length !== 3) throw new Error("INFRASTRUCTURE: disposable database lacks registry tables");
    } finally {
      db.close();
    }
    writeFileSync(join(hermesHome, "config.yaml"), config);
    writeFileSync(join(hermesHome, ".env"), `ANTHROPIC_API_KEY=${FICTIONAL_KEY}\n`);
    if (!existsSync(CLI)) throw new Error("INFRASTRUCTURE: explicit Hermes registry import CLI is not present yet");
    check(dataDir, env);
  } finally {
    const actual = realpathSync(root);
    if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
      throw new Error("INFRASTRUCTURE: refusing to remove a fixture outside the temporary directory");
    }
    rmSync(actual, { recursive: true, force: true });
  }
}

describe("T-0161 explicit Hermes registry import", () => {
  it("imports a model, agent default and linked credential into PS_DATA_DIR without a database argument", () => {
    withMigratedFixture(
      `model:\n  default: ${MODEL_ID}\n  provider: anthropic\n  base_url: https://api.anthropic.com\n`,
      (dataDir, env) => {
        const imported = run(process.execPath, [CLI], env);
        if (imported.error || imported.signal) {
          throw new Error(`INFRASTRUCTURE: import CLI could not launch (${imported.error?.message ?? imported.signal})`);
        }
        expect(imported.status).toBe(0);

        const db = new DatabaseCtor(join(dataDir, "patterstage.db"));
        try {
          const row = db.prepare(`
            SELECT m.model_id, m.provider, d.task_type, c.api_key
              FROM models AS m
              LEFT JOIN model_defaults AS d ON d.model_id = m.id
              LEFT JOIN credentials AS c ON c.id = m.credentials_id
             WHERE m.model_id = ?
          `).get(MODEL_ID) as { model_id: string; provider: string; task_type: string | null; api_key: string | null } | undefined;
          expect({ model: row?.model_id, provider: row?.provider, defaultSlot: row?.task_type }).toEqual({
            model: MODEL_ID,
            provider: "anthropic",
            defaultSlot: "agent",
          });
          // Compare booleans so Jest never prints even this fictional key on failure.
          expect(row?.api_key === FICTIONAL_KEY).toBe(true);
        } finally {
          db.close();
        }
      },
    );
  });

  it("exits non-zero for malformed Hermes config", () => {
    withMigratedFixture("model: [unterminated\n", (_dataDir, env) => {
      const imported = run(process.execPath, [CLI], env);
      if (imported.error || imported.signal) {
        throw new Error(`INFRASTRUCTURE: import CLI could not launch (${imported.error?.message ?? imported.signal})`);
      }
      expect(imported.status).not.toBe(0);
    });
  });
});
