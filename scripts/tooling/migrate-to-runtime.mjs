#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// migrate-to-runtime.mjs — one-time forward migration to the runtime core
//
// Converts legacy Hermes-cron-backed recurring missions into PatterStage-owned
// `schedules`, and fails any mission left "dispatched" by the old bash backend
// (no `runs` row). Dry-run by default; pass --apply to write. Idempotent:
// missions that already have a schedule are skipped.
//
//   node scripts/tooling/migrate-to-runtime.mjs            # dry run
//   node scripts/tooling/migrate-to-runtime.mjs --apply    # write
//   node scripts/tooling/migrate-to-runtime.mjs --db /path/to/control-hub.db
//
// Migrated schedules get next_run_at = now, so they fire on the next scheduler
// tick and THEN advance to their real next occurrence via the app's own cron
// math — no schedule logic is reimplemented here. Back up control-hub.db first.
// ═══════════════════════════════════════════════════════════════

import Database from "better-sqlite3";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const dbFlag = argv.indexOf("--db");
const dataRoot =
  process.env.PS_DATA_DIR ||
  process.env.CH_DATA_DIR ||
  process.env.CONTROL_HUB_DATA_DIR ||
  join(homedir(), "patterstage", "data");
const dbInRoot = (dir) =>
  !existsSync(join(dir, "patterstage.db")) && existsSync(join(dir, "control-hub.db"))
    ? join(dir, "control-hub.db")
    : join(dir, "patterstage.db");
const dbPath = dbFlag !== -1 ? argv[dbFlag + 1] : dbInRoot(dataRoot);

if (!dbPath || !existsSync(dbPath)) {
  console.error(`database not found at: ${dbPath}\nPass --db <path> or set PS_DATA_DIR.`);
  process.exit(1);
}

const db = new Database(dbPath);
const tableExists = (name) =>
  Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name));

if (!tableExists("schedules")) {
  console.error("schedules table is missing — start PatterStage once so migrations run, then re-run.");
  process.exit(1);
}

const nowIso = new Date().toISOString();

// 1) Legacy cron_jobs linked to a mission → schedules.
const cronRows = tableExists("cron_jobs")
  ? db
      .prepare(
        `SELECT c.id AS cron_id, c.name, c.schedule, c.schedule_display, c.profile_name, c.enabled,
                m.id AS mission_id
           FROM cron_jobs c
           JOIN missions m ON m.cron_job_id = c.id
          WHERE m.deleted_at IS NULL`,
      )
      .all()
  : [];

const hasSchedule = db.prepare("SELECT 1 FROM schedules WHERE mission_id = ? LIMIT 1");
const insertSchedule = db.prepare(
  `INSERT INTO schedules
     (id, mission_id, name, schedule, schedule_display, enabled, catch_up_policy,
      repeat_done, profile_name, next_run_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, 'fire_once', 0, ?, ?, ?, ?)`,
);

let created = 0;
let skipped = 0;
for (const r of cronRows) {
  if (hasSchedule.get(r.mission_id)) {
    skipped += 1;
    continue;
  }
  if (apply) {
    insertSchedule.run(
      randomUUID(),
      r.mission_id,
      r.name ?? "",
      r.schedule,
      r.schedule_display ?? r.schedule,
      r.enabled ?? 1,
      r.profile_name ?? null,
      nowIso,
      nowIso,
      nowIso,
    );
  }
  created += 1;
}

// 2) Missions left "dispatched" by the old bash backend (no runs row) → failed.
const stuck = db
  .prepare(
    `SELECT id FROM missions
      WHERE status = 'dispatched' AND deleted_at IS NULL
        AND id NOT IN (SELECT mission_id FROM runs WHERE mission_id IS NOT NULL)`,
  )
  .all();
const failStmt = db.prepare(
  "UPDATE missions SET status='failed', result='Interrupted by rewrite migration', updated_at=? WHERE id=?",
);
let failed = 0;
for (const m of stuck) {
  if (apply) failStmt.run(nowIso, m.id);
  failed += 1;
}

console.log(
  `${apply ? "APPLIED" : "DRY RUN"}: schedules to create=${created} (skipped ${skipped} already-migrated), stuck missions to fail=${failed}`,
);
console.log(
  apply
    ? "Done. Migrated schedules fire on the next scheduler tick, then advance to their real next occurrence."
    : "Re-run with --apply to write changes. Back up control-hub.db first.",
);
db.close();
