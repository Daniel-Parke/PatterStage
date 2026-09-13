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

import { rmSync } from "fs";

// Passed by playwright.config.ts so the path has exactly one definition.
const dataDir = process.argv[2];

if (!dataDir) {
  console.error("[e2e prepare-data-dir] no data dir argument; refusing to guess");
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

console.log(`[e2e prepare-data-dir] wiped ${dataDir}; server will boot onto a fresh, seeded DB`);
