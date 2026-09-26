// ═══════════════════════════════════════════════════════════════
// prepare-data-dir.mjs: wipe the isolated E2E data dir BEFORE the
// server boots. Run as the first half of `webServer.command`.
//
// This deliberately does NOT live in Playwright's globalSetup, and the
// ordering is the whole point.
//
// Playwright starts `webServer` FIRST and runs globalSetup afterwards,
// once the server already answers on baseURL. PatterStage seeds its
// catalogue at boot (src/instrumentation.ts calls
// ensureCatalogSeededOnce), so a wipe issued from globalSetup deletes
// the database the running server has just seeded, while that server
// holds it open.
//
// The two platforms then diverge, which is why this hid for so long:
//
//   Windows: rmSync fails with EPERM because the SQLite handles are
//     open, the wipe is skipped, the seeded DB survives, the suite
//     passes.
//   Linux:   rmSync succeeds. src/lib/db recreates the directory and
//     an EMPTY database on the next query, migrations run through
//     getDb(), but ensureCatalogSeededOnce only runs at boot and has
//     already been and gone. Every seeded row is gone for the rest of
//     the run, and the server logs "Cannot open database because the
//     directory does not exist" until the directory is remade.
//
// That is what failed "creative-lead profile shows non-empty toolsets
// after load" on the first e2e-full run (32609836399) while the same
// test passed on every developer machine: the profile selector had
// only the synthesised `default` profile in it, because the catalogue
// the server seeded had been deleted underneath it.
//
// Running the wipe here puts it strictly before boot, which is the only
// ordering that gives the suite a database that is both fresh AND
// seeded.
// ═══════════════════════════════════════════════════════════════

import { existsSync, lstatSync, mkdirSync, realpathSync, rmSync } from "fs";
import { spawnSync } from "child_process";
import { tmpdir } from "os";
import { dirname, join, resolve, sep } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

// Passed by playwright.config.ts so the path has exactly one definition.
const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const dataDir = process.argv[2] ? resolve(process.argv[2]) : null;
const fixtureId = "e2e-session-fixture";

if (!dataDir) {
  console.error("[e2e prepare-data-dir] no data dir argument; refusing to guess");
  process.exit(1);
}

// The only permitted wipe targets are this checkout's tmp/ and the OS temp
// directory used by the fixture oracle. Resolve an existing junction before
// deleting so a caller cannot point the test harness at operator data.
const normalise = (path) => process.platform === "win32" ? path.toLowerCase() : path;
const within = (path, base) => normalise(path).startsWith(normalise(base) + sep);
const allowedRoots = [join(root, "tmp"), tmpdir()].map((path) => {
  const lexical = resolve(path);
  return { lexical, physical: existsSync(lexical) ? realpathSync(lexical) : lexical };
});
if (!allowedRoots.some(({ lexical }) => within(dataDir, lexical))) {
  console.error("[e2e prepare-data-dir] refusing a path outside an isolated temporary directory");
  process.exit(1);
}
mkdirSync(dirname(dataDir), { recursive: true });
const parent = realpathSync(dirname(dataDir));
if (!allowedRoots.some(({ lexical, physical }) => within(dataDir, lexical) &&
    (normalise(parent) === normalise(physical) || within(parent, physical))) ||
    (existsSync(dataDir) && lstatSync(dataDir).isSymbolicLink())) {
  console.error("[e2e prepare-data-dir] refusing a path outside an isolated temporary directory");
  process.exit(1);
}

// Not best-effort. A wipe that silently fails hands the run a database
// carried over from a previous run, and the whole reason this directory
// is isolated is that leftovers are what make a suite lie. The one
// legitimate cause of failure here is a process still holding the
// files, which is exactly the condition worth stopping for.
try {
  rmSync(dataDir, { recursive: true, force: true });
} catch (err) {
  console.error(
    `[e2e prepare-data-dir] could not wipe ${dataDir}: ${err.message}\n` +
      "[e2e prepare-data-dir] something still holds this directory open " +
      "(a leftover server?). Stop it and re-run; continuing would test a stale database.",
  );
  process.exit(1);
}

mkdirSync(dataDir, { recursive: true });
const migration = spawnSync(
  process.execPath,
  ["--import", "tsx", join(root, "scripts", "tooling", "migrate-db.ts")],
  {
    cwd: root,
    env: { ...process.env, PS_DATA_DIR: dataDir, CH_DATA_DIR: dataDir },
    encoding: "utf8",
    timeout: 60_000,
  },
);
if (migration.status !== 0) {
  console.error(`[e2e prepare-data-dir] isolated schema migration failed (exit ${migration.status ?? "launch failure"})`);
  process.exit(1);
}

const database = new Database(join(dataDir, "patterstage.db"));
try {
  database.prepare(`
    INSERT INTO sessions (id, agent_type, source, title, started_at, ended_at, status)
    VALUES (?, 'hermes', 'cli', 'E2E fixture session', ?, ?, 'completed')
  `).run(fixtureId, "2026-01-01T00:00:00.000Z", "2026-01-01T00:01:00.000Z");
} finally {
  database.close();
}
console.log(`[e2e prepare-data-dir] fresh isolated database with session fixture ${fixtureId}`);
