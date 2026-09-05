// ═══════════════════════════════════════════════════════════════
// apply-cron-schedule-canonicalisation.ts
// ═══════════════════════════════════════════════════════════════
//
// One-shot data migration that re-derives the `cron_jobs.schedule`
// column for rows written before the schedule canonicalisation fix.
//
// History
// -------
// `cron_jobs.schedule` historically held a JSON-stringified
// ParsedSchedule like `{"kind":"cron","expr":"0 9 * * *","display":"0 9 * * *"}`.
// Round-tripping that through the Hermes file caused the scheduler to
// reject the job and rewrite it as `{"kind":"invalid","raw":"...","message":"Unrecognized
// schedule: ..."}`. The corruption was silent (no API error), but the
// job never fired because the scheduler treated its schedule as
// unparseable.
//
// Canonical form going forward
// ----------------------------
// The `schedule` column holds a raw 5-field cron expression (e.g.
// `"0 9 * * 1-5"` or the "every 2h" shorthand). The `schedule_display`
// column carries the human label. This file rewrites existing rows
// to that form so the CH↔Hermes round-trip is stable.
//
// Idempotency
// -----------
// Running this migration twice is a no-op. Rows already in the
// canonical form (raw 5-field cron, no leading `{`) are left alone.
// The migration runs in a single transaction and never raises.

import type Database from "better-sqlite3";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { intervalShorthandToCron } from "@/lib/schedule/parse-schedule";

export const CRON_SCHEDULE_CANONICALISATION_SCHEMA_VERSION = 7;

interface ScheduleRow {
  id: string;
  schedule: string;
}

interface ParsedScheduleShape {
  kind?: unknown;
  expr?: unknown;
  display?: unknown;
  raw?: unknown;
}

/**
 * Extract the canonical 5-field cron expression from a stored
 * `cron_jobs.schedule` value, regardless of which generation of
 * storage shape the row was written in.
 *
 * Returns null when no recoverable cron is found (so the caller can
 * leave the row alone or log a warning — but never throws, so this
 * is safe to run across a heterogeneous dataset).
 */
function extractRawCron(stored: string): string | null {
  if (!stored) return null;
  const trimmed = stored.trim();
  if (!trimmed) return null;

  // Already canonical: a raw 5-field cron that doesn't start with `{`.
  if (!trimmed.startsWith("{")) {
    // "every Nm / Nh / Nd" shorthand stored verbatim — convert to a
    // 5-field cron expression. This is the live-mission bug fix
    // (mission/hermes-review-and-refactor ref, 2026-06-10).
    return intervalShorthandToCron(trimmed) ?? trimmed;
  }

  // Legacy / corrupted: try to unwrap the JSON-stringified ParsedSchedule.
  let parsed: ParsedScheduleShape;
  try {
    parsed = JSON.parse(trimmed) as ParsedScheduleShape;
  } catch {
    return null;
  }

  // Direct `expr` field (the "JSON-stringified ParsedSchedule" legacy
  // form: `{"kind":"cron","expr":"0 9 * * *","display":"0 9 * * *"}`).
  if (typeof parsed.expr === "string" && parsed.expr.trim()) {
    return parsed.expr.trim();
  }

  // Corrupted: `kind: "invalid"` with `raw` containing a JSON
  // stringified ParsedSchedule one level deeper.
  if (parsed.kind === "invalid" && typeof parsed.raw === "string") {
    try {
      const inner = JSON.parse(parsed.raw) as ParsedScheduleShape;
      if (typeof inner.expr === "string" && inner.expr.trim()) {
        return inner.expr.trim();
      }
    } catch {
      // fall through
    }
  }

  return null;
}

/**
 * Apply the schedule canonicalisation rewrite to every row in
 * `cron_jobs` whose `schedule` column is not already in the canonical
 * raw-cron form. Bumps `schema_version` to 6 when the migration has
 * run for the first time on a given database.
 *
 * Returns the number of rows rewritten (0 when nothing to do).
 */
export function applyCronScheduleCanonicalisation(
  database: Database.Database,
): number {
  const current = getSchemaVersion(database);
  // Always safe to re-run the row rewrite, but only bump the schema
  // version on the first run so other code can detect "post-fix" rows.
  const rows = database
    .prepare("SELECT id, schedule FROM cron_jobs")
    .all() as ScheduleRow[];

  let rewritten = 0;

  const updateStmt = database.prepare(
    "UPDATE cron_jobs SET schedule = ?, updated_at = ? WHERE id = ?",
  );

  const tx = database.transaction((batch: ScheduleRow[]) => {
    const now = new Date().toISOString();
    for (const row of batch) {
      const raw = extractRawCron(row.schedule);
      if (raw === null) continue;
      // Skip if already canonical (no leading brace, no JSON wrapping).
      if (!row.schedule.trim().startsWith("{") && row.schedule === raw) {
        continue;
      }
      updateStmt.run(raw, now, row.id);
      rewritten += 1;
    }
  });

  try {
    tx(rows);
  } catch (err) {
    // Never let a malformed row take the migration down. Log and
    // continue — the next push-to-Hermes cycle will overwrite
    // schedule on the next user edit.
    console.warn(
      "[cron-schedule-canonicalisation] partial apply; some rows left untouched:",
      err,
    );
  }

  if (current < CRON_SCHEDULE_CANONICALISATION_SCHEMA_VERSION) {
    setSchemaVersion(database, CRON_SCHEDULE_CANONICALISATION_SCHEMA_VERSION);
  }

  return rewritten;
}
