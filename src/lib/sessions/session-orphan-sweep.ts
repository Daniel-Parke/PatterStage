// session-orphan-sweep.ts: closes the session rows the agent will never tell us
// about, stuck on "active". Called once from `syncHermesSessionsToDb`, and
// driven on its own by the admin backfill endpoint.
//
// Preview and write derive their cutoffs from one `now` (computeOrphanCutoffs)
// and count through one mutation (tallyOrphanRows), so the dry-run tally and
// the post-write tally have the same shape by construction. The statements are
// in ./session-sync-repository, where the dry-run SELECTs sit beside the UPDATEs
// they mirror; the try/catch stays here because a failed sweep is a non-fatal
// "closed nothing this tick", and that judgement is the sweep's.

import type Database from "better-sqlite3";

import {
  closeMissionGatedOrphans,
  closeParentlessOrphans,
  selectMissionGatedOrphans,
  selectParentlessOrphans,
} from "./session-sync-repository";

// Log suppression for the write path. The 15s sync re-runs the sweep every
// tick, so the log fires only on first occurrence and on a shift of >=100.
// Audit-referenced: dogfood-output/report.md Issue #3.
let lastOrphanCloseCount: number | null = null;

/**
 * ISO-8601 cutoffs (the format the `?` placeholders expect). `shortCutoff` is
 * the 5-minute boot-safety gate: the agent may still be writing its first
 * message. `longCutoff` is the 30-minute orphan gate: older is dead even with no
 * output. One `now` for both, so preview and write agree (the
 * `preview === actual` parity test catches drift).
 */
export function computeOrphanCutoffs(now: number = Date.now()): {
  shortCutoff: string;
  longCutoff: string;
} {
  return {
    shortCutoff: new Date(now - 5 * 60 * 1000).toISOString(),
    longCutoff: new Date(now - 30 * 60 * 1000).toISOString(),
  };
}

/**
 * Tally `{ source, status }` rows into an `OrphanSweepResult` in place; `status`
 * is the status the row would (or did) receive. Dry run and write both tally
 * here, so the two counts have the same shape.
 */
export function tallyOrphanRows(
  rows: ReadonlyArray<{ source: string; status: string }>,
  counters: { total: number; bySource: Record<string, number>; byNewStatus: Record<string, number> },
): void {
  for (const row of rows) {
    counters.total += 1;
    counters.bySource[row.source] = (counters.bySource[row.source] ?? 0) + 1;
    counters.byNewStatus[row.status] = (counters.byNewStatus[row.status] ?? 0) + 1;
  }
}

/**
 * What the sweep would change, without writing: the admin backfill endpoint's
 * `dryRun`. The SELECTs mirror the UPDATE predicates in
 * `closeOrphanedActiveSessions`, so the counts agree modulo concurrent sync.
 */
export function previewOrphanSweep(
  database: Database.Database,
): OrphanSweepResult {
  const { shortCutoff: cutoff, longCutoff } = computeOrphanCutoffs();
  const counters: OrphanSweepResult = { total: 0, bySource: {}, byNewStatus: {} };

  // (A) parent-mission gated, mirroring closeOrphanedActiveSessions (A);
  // mission_id IS NOT NULL keeps parentless rows for (B).
  try {
    const rows = selectMissionGatedOrphans(database, cutoff);
    tallyOrphanRows(
      rows.map((r) => ({ source: r.source, status: r.new_status })),
      counters,
    );
  } catch {
    // non-fatal
  }

  // (B) parentless age-only fallback, mirroring closeOrphanedActiveSessions (B).
  // It always assigns status='completed', so the row is tagged before tallying.
  try {
    const rows = selectParentlessOrphans(database, cutoff, longCutoff);
    tallyOrphanRows(
      rows.map((r) => ({ source: r.source, status: "completed" })),
      counters,
    );
  } catch {
    // non-fatal
  }

  return counters;
}

/**
 * Close active session rows that should be terminal but never got the status
 * update. Exported for the admin backfill endpoint
 * (`/api/admin/sessions/backfill-status`), which dry-runs and applies on demand.
 * Returns counts by source and by new status. `options.log` controls the
 * throttled console log: the sync path passes `log: true`, the admin endpoint
 * `log: false` and returns the counts instead.
 */
export interface OrphanSweepResult {
  total: number;
  bySource: Record<string, number>;
  byNewStatus: Record<string, number>;
}

export function closeOrphanedActiveSessions(
  database: Database.Database,
  options: { log?: boolean } = {},
): OrphanSweepResult {
  const { shortCutoff: cutoff, longCutoff } = computeOrphanCutoffs();
  const counters: OrphanSweepResult = { total: 0, bySource: {}, byNewStatus: {} };

  // (A) Parent-mission gated close, for every source whose row carries a
  // mission_id. A recurring mission has one row per run; the active one is
  // closed, latest started_at, as closeSessionForMission() does. A CTE LEFT
  // JOINs the parent so a missing one still matches:
  //   'successful'                    → 'completed', exit 0
  //   'failed' / 'cancelled'          → 'failed', exit 1
  //   anything else but 'dispatched'  → 'completed', exit 0 (parent no longer running)
  //   missing or soft-deleted         → 'completed', exit 0 (the reference is stale)
  // RETURNING gives the rows this call changed, not a re-read that would
  // double-count across sync ticks.
  try {
    const changedRows = closeMissionGatedOrphans(database, cutoff);
    tallyOrphanRows(changedRows, counters);
  } catch {
    // non-fatal — the table layout or FK may not permit the join
  }

  // (B) Age-only fallback for sessions with no parent mission. Either gate
  // closes it:
  //   (i)  size > 0 AND started > 5 min ago: the original cli/api sweep, sparing
  //        a session still writing before the gateway propagates `end_reason`;
  //   (ii) started > 30 min ago regardless of size: the parent mission was never
  //        created and no status file written. Deliberately generous; a real
  //        session that slow has a bigger problem than reading "active".
  try {
    const changedRows = closeParentlessOrphans(database, cutoff, longCutoff);
    // The (B) UPDATE has no CASE branch, so every row is tagged 'completed'
    // before tallying: `tallyOrphanRows` reads `row.status` directly.
    tallyOrphanRows(
      changedRows.map((r) => ({ source: r.source, status: "completed" })),
      counters,
    );
  } catch {
    // non-fatal
  }

  if (options.log !== false) {
    if (counters.total > 0 && (lastOrphanCloseCount === null || Math.abs(counters.total - lastOrphanCloseCount) >= 100)) {
      console.log(`[syncHermesSessionsToDb] closed ${counters.total} orphaned active sessions`);
      lastOrphanCloseCount = counters.total;
    } else if (counters.total === 0 && lastOrphanCloseCount !== null && lastOrphanCloseCount > 0) {
      console.log(`[syncHermesSessionsToDb] orphan session queue drained (was ${lastOrphanCloseCount})`);
      lastOrphanCloseCount = null;
    } else if (counters.total > 0) {
      lastOrphanCloseCount = counters.total;
    }
  }

  return counters;
}
