// ═══════════════════════════════════════════════════════════════
// session-orphan-sweep.ts: closing sessions stuck on "active"
//
// Split out of session-sync.ts. The sweep is its own responsibility:
// the sync pipeline's job is "make our table agree with the agent's
// state.db", and the sweep's job is "close the rows the agent will
// never tell us about". They meet at exactly one call, from
// `syncHermesSessionsToDb`, and the admin backfill endpoint drives
// the sweep on its own without going near the sync.
//
// Four exports, in the order the sweep uses them:
//   - computeOrphanCutoffs, the two point-in-time gates, derived
//     from one `now` so preview and write cannot disagree.
//   - tallyOrphanRows, the shared counter mutation, so a dry-run
//     tally and a post-write tally have the same shape by
//     construction rather than by inspection.
//   - previewOrphanSweep, the dry run (SELECTs that mirror the
//     UPDATE predicates).
//   - closeOrphanedActiveSessions, the write.
//
// `lastOrphanCloseCount` (the log suppression) lives here because it
// belongs to the write path and nothing else may touch it. It is
// audit-referenced: see dogfood-output/report.md Issue #3.
//
// The four statements now live in ./session-sync-repository, where the
// dry-run SELECTs sit beside the UPDATEs they have to mirror. The
// try/catch around each call stays here: a failed sweep is a
// non-fatal "closed nothing this tick", and that judgement belongs to
// the sweep, not to the repository.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";

import {
  closeMissionGatedOrphans,
  closeParentlessOrphans,
  selectMissionGatedOrphans,
  selectParentlessOrphans,
} from "./session-sync-repository";

// Tracks the most recent orphan-close count so the periodic log can
// suppress the steady-state churn and only fire when the count changes
// meaningfully. Reset to null to log a fresh first-occurrence value.
// See audit Issue #3 (dogfood-output/report.md).
let lastOrphanCloseCount: number | null = null;

/**
 * Orphan-sweep cutoffs, in ISO-8601 strings (the format the `?`
 * placeholders expect). `shortCutoff` is the 5-minute boot-safety
 * gate (don't close anything started more recently than this — the
 * agent might still be writing its first message). `longCutoff` is
 * the 30-minute orphan gate (anything older than this is
 * unambiguously dead, even if it never produced output).
 *
 * The two cutoffs are computed in lockstep from a single `now` so
 * `previewOrphanSweep` and `closeOrphanedActiveSessions` always
 * see the same point-in-time. The preview function reads them to
 * build its dry-run SELECTs; the close function reads them to
 * build its UPDATE predicates. Keeping the cutoffs in a single
 * pure helper is what makes the dry-run count match the write
 * count (the existing `preview === actual` parity test would
 * catch any drift).
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
 * Tally a batch of `{ source, status }` rows into the `OrphanSweepResult`
 * counter object. Pure mutation in place (the function name carries
 * the `tally` verb; the `OrphanSweepResult` shape is mutated, not
 * returned). Each row contributes `+1` to `total`, `+1` to
 * `bySource[source]`, and `+1` to `byNewStatus[status]`.
 *
 * The status field is the "new status" the row would receive
 * (or did receive) — `'completed'` for the (B) age-fallback path,
 * `'completed'`/`'failed'` for the (A) mission-gated path
 * depending on the parent mission's status. Source is the
 * `sessions.source` column (`cli`/`api`/`mission`/`cron`/etc).
 *
 * Both `previewOrphanSweep` and `closeOrphanedActiveSessions` call
 * this with their respective row arrays, so the tally shape stays
 * byte-equivalent between the dry-run and write paths. The
 * existing 2x inlined `for (const row of rows) { total++;
 * bySource[row.source]++; byNewStatus[row.status]++; }` blocks
 * (one per (A)/(B) path, × 2 functions) collapse to 4 single-line
 * calls.
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
 * Preview what the orphan sweep would change, without writing.
 *
 * Counts active sessions that match the close criteria, broken down
 * by source and by the status they would receive. Used by the admin
 * backfill endpoint's `dryRun` mode.
 *
 * The dry-run SELECTs mirror the UPDATE predicates in `closeOrphanedActiveSessions`
 * exactly, so the dry-run count equals the post-write count (modulo
 * concurrent sync activity).
 */
export function previewOrphanSweep(
  database: Database.Database,
): OrphanSweepResult {
  const { shortCutoff: cutoff, longCutoff } = computeOrphanCutoffs();
  const counters: OrphanSweepResult = { total: 0, bySource: {}, byNewStatus: {} };

  // (A) parent-mission gated: status derived from mission.status
  // (LEFT JOIN so missing/soft-deleted parents are also matched;
  // mission_id IS NOT NULL keeps parentless rows out — they belong
  // to path (B))
  try {
    const rows = selectMissionGatedOrphans(database, cutoff);
    tallyOrphanRows(
      rows.map((r) => ({ source: r.source, status: r.new_status })),
      counters,
    );
  } catch {
    // non-fatal
  }

  // (B) age-only fallback for parentless sessions. Same dual-gate
  // logic as closeOrphanedActiveSessions (B): size>0 OR >30-min-old.
  // Per the tally contract, the (B) path always assigns status='completed',
  // so the source row is tagged as such before being tallied.
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
 * Close active session rows that should be terminal but never got the
 * status update.
 *
 * Exported for the admin backfill endpoint (`/api/admin/sessions/backfill-status`)
 * so the operator can dry-run + apply the same sweep on demand.
 *
 * Returns counts by source and by new status. `options.log` controls
 * whether the function emits its own throttled console log; the
 * recurring sync path passes `log: true` to inherit the existing
 * suppression behaviour, while the admin endpoint passes `log: false`
 * (it returns the counts to the caller instead).
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

  // (A) Parent-mission gated close. Applies to all sources whose
  // session row carries a mission_id (mission, cron, and any
  // session Hermes tagged with a mission via its profile).
  // Recurring missions produce one row per run — we close the
  // active one for that mission, picking the latest started_at
  // (matches the behaviour of closeSessionForMission()).
  //
  // Four sub-cases (driven by a CTE that does a LEFT JOIN so missing
  // parents still match):
  //   1. Parent mission exists, status = 'successful' → 'completed', exit 0
  //   2. Parent mission exists, status in ('failed', 'cancelled') → 'failed', exit 1
  //   3. Parent mission exists, status = anything else (incl. 'queued', 'draft')
  //      but NOT 'dispatched' → 'completed', exit 0 (the parent is no longer
  //      running, so the session has ended)
  //   4. Parent mission is missing OR soft-deleted → 'completed', exit 0
  //      (the session is by definition orphaned; the parent reference is
  //      stale and the session is no longer associated with anything live)
  //
  // We use RETURNING to get a per-row breakdown of the actual
  // changes this call made (not a re-read of all matching rows,
  // which would double-count across sync ticks).
  try {
    const changedRows = closeMissionGatedOrphans(database, cutoff);
    tallyOrphanRows(changedRows, counters);
  } catch {
    // non-fatal — the table layout or FK may not permit the join
  }

  // (B) Age-only fallback. Sessions with no parent mission. Two
  // independent gates both close the session, so a session only
  // needs to satisfy *one* of them to be considered terminal:
  //
  //   (i)  size > 0 AND started > 5 min ago — the original
  //        cli/api sweep logic; protects against closing a session
  //        that's actively writing content but the gateway hasn't
  //        propagated `end_reason` to us yet.
  //   (ii) started > 30 min ago (regardless of size) — catches
  //        sessions that are clearly orphaned: their parent mission
  //        was never created, the dispatcher never wrote a status
  //        file, and 30 minutes is far past any conceivable
  //        in-progress window. The 30-min number is intentionally
  //        generous — any real Hermes session that takes >30 min
  //        to start writing content has a much bigger problem than
  //        the Sessions page showing it as "active".
  //
  // The 15s sync cycle re-runs these UPDATEs on every tick, so
  // without log suppression the message would fire ~4×/min with a
  // count that hovers between the same values forever. Suppress
  // the noise; only log on first occurrence and on a real shift
  // of >=100. Audit reference: dogfood-output/report.md Issue #3.
  try {
    const changedRows = closeParentlessOrphans(database, cutoff, longCutoff);
    // The (B) UPDATE always assigns status='completed' (the SQL has
    // no CASE branch). Tag each source row as such before tallying
    // — `tallyOrphanRows` reads `row.status` directly.
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
