// ═══════════════════════════════════════════════════════════════
// session-sync.ts — Hermes state.db → sessions table sync + orphan sweep
//
// Split out of session-repository.ts (which is now pure CRUD). This
// module owns the "read Hermes's state.db and reconcile it into our
// sessions table" side of the registry:
//
//   - readHermesSessionsFromStateDb / syncHermesSessionsToDb — the
//     upsert pipeline run on the 15s sessions sync cycle (SessionSync)
//     and on-demand via listSessions({ syncIfActive }).
//   - the mission-id resolution helpers (buildMissionIdByJobId,
//     lookupMissionIdForHermesJob, lookupMissionIdForCronSession).
//   - the orphan sweep (computeOrphanCutoffs, tallyOrphanRows,
//     previewOrphanSweep, closeOrphanedActiveSessions) that closes
//     sessions stuck on "active" forever.
//
// It depends on session-repository only for the pure `estimateSessionSize`
// helper and the `SessionStatus` type — a one-directional edge. The
// repository imports `syncHermesSessionsToDb` back, but only from inside
// `listSessions` (a function-level reference), so there's no
// module-init cycle.
// ═══════════════════════════════════════════════════════════════

import Database from "better-sqlite3";
import { existsSync } from "fs";
import { join } from "path";

import { getDb } from "../db";
import { getAgentWorkspace } from "../runtime/workspace";
import { SERVER_MODULES } from "../modules/server";
import { parseCronSessionId, cronJobIdFromSessionId } from "./session-title";
import { estimateSessionSize, type SessionStatus } from "./session-repository";

// ── Hermes state.db sync ──────────────────────────────────────

interface HermesSessionRow {
  id: string;
  source: string;
  model: string;
  title: string | null;
  started_at: number;
  ended_at: number | null;
  end_reason: string | null;
  message_count: number | null;
  api_call_count: number | null;
}

function hermesStatusFromEndReason(
  end_reason: string | null,
): { status: SessionStatus; exitCode: number | null } {
  if (!end_reason) return { status: "active", exitCode: null };
  switch (end_reason) {
    case "stop":
    case "token_limit":
    case "max_iterations":
      return { status: "completed", exitCode: 0 };
    case "timeout":
    case "interrupt":
      return { status: "completed", exitCode: 143 };
    case "error":
      return { status: "failed", exitCode: 1 };
    default:
      return { status: "completed", exitCode: null };
  }
}

function readHermesSessionsFromStateDb(): HermesSessionRow[] {
  const root = getAgentWorkspace().root;
  const stateDbPath = join(root, "state.db");
  if (!existsSync(stateDbPath)) return [];

  let hermesDb: Database.Database | null = null;
  try {
    hermesDb = new Database(stateDbPath, { readonly: true });

    const tables = hermesDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
      .all();
    if (tables.length === 0) {
      hermesDb.close();
      hermesDb = null;
      return [];
    }

    const rows = hermesDb
      .prepare(
        // LIMIT bounds the sync cost on a giant state.db. The /api/sessions
        // route paginates 50 per page anyway, and 10K is a generous ceiling
        // for any UI use case. The full set can still be inspected via the
        // Hermes CLI (`hermes sessions list`). See session-repository.ts
        // header for the FTS-bloat rationale.
        `SELECT id, source, model, title, started_at, ended_at, end_reason, message_count, api_call_count
         FROM sessions ORDER BY started_at DESC LIMIT 10000`,
      )
      .all() as HermesSessionRow[];
    hermesDb.close();
    hermesDb = null;

    return rows;
  } catch {
    return [];
  } finally {
    if (hermesDb) {
      try { hermesDb.close(); } catch { /* already closed or never fully opened */ }
    }
  }
}

/**
 * Build a set of all mission IDs from PatterStage's missions table.
 * Includes soft-deleted missions — the FK constraint only checks id existence,
 * not deleted_at. Used to filter session mission_ids so we never insert
 * a mission_id that would violate the FK.
 */
function buildValidMissionIdSet(): Set<string> {
  try {
    const rows = getDb()
      .prepare("SELECT id FROM missions")
      .all() as Array<{ id: string }>;
    return new Set(rows.map((r) => r.id));
  } catch {
    return new Set();
  }
}

/**
 * Build a map of Hermes job ID -> PatterStage mission UUID.
 *
 * Correct join path:
 *   Hermes job ID (e.g. "9514116b5b0d")
 *     -> cron_jobs.external_job_id = job ID
 *     -> cron_jobs.id = cron_job UUID
 *     -> missions.cron_job_id = cron_jobs.id (FK to cron_jobs)
 *     -> missions.id = mission UUID
 */
function buildMissionIdByJobId(): Map<string, string> {
  const missionIdByJobId = new Map<string, string>();
  try {
    const rows = getDb()
      .prepare(`
        SELECT m.id AS mission_id, c.external_job_id
        FROM missions m
        JOIN cron_jobs c ON c.id = m.cron_job_id
        WHERE c.external_job_id IS NOT NULL AND c.external_job_id != ''
      `)
      .all() as Array<{ mission_id: string; external_job_id: string }>;
    for (const row of rows) {
      missionIdByJobId.set(row.external_job_id, row.mission_id);
    }
  } catch {
    // table structure may differ — non-fatal
  }
  return missionIdByJobId;
}

/**
 * Look up the PatterStage mission id for a single Hermes cron job id.
 *
 * Used by the per-session detail API (`/api/sessions/[id]`) to surface
 * an "Open Mission" link on the transcript page for cron-spawned sessions
 * without paying for a full sync build of the job-id → mission-id map.
 *
 * Companion to `buildMissionIdByJobId` (bulk version used during the
 * 15s sessions sync). Both use the same join path:
 *   cron_jobs.external_job_id → cron_jobs.id → missions.cron_job_id → missions.id
 *
 * Returns null when the job id is missing/empty, when the DB is
 * unavailable, or when no mission has been registered for the job
 * (the detail page just doesn't render a Mission link in that case).
 */
function lookupMissionIdForHermesJob(externalJobId: string): string | null {
  if (!externalJobId) return null;
  try {
    const row = getDb()
      .prepare(
        `SELECT m.id AS mission_id
         FROM missions m
         JOIN cron_jobs c ON c.id = m.cron_job_id
         WHERE c.external_job_id = ?
         LIMIT 1`,
      )
      .get(externalJobId) as { mission_id: string } | undefined;
    return row?.mission_id ?? null;
  } catch {
    // DB unavailable or schema differs — non-fatal
    return null;
  }
}

/**
 * Best-effort lookup of the PatterStage mission id for a cron-spawned
 * session. The session id has the form `cron_<job-uuid>_<date>_<time>`;
 * the job uuid resolves to cron_jobs.id, which resolves to missions.id
 * via the missions.cron_job_id FK. Returns null for non-cron sessions
 * or when no mission has been registered for the job.
 *
 * Used by the per-session detail API (`/api/sessions/[id]`) so the
 * transcript page can render an "Open Mission" link for cron-spawned
 * sessions without doing the bulk sync build (`buildMissionIdByJobId`).
 */
export function lookupMissionIdForCronSession(sessionId: string): string | null {
  const jobId = cronJobIdFromSessionId(sessionId);
  if (!jobId) return null;
  return lookupMissionIdForHermesJob(jobId);
}

/**
 * Sync Hermes sessions into the sessions table.
 *
 * Reads session metadata from Hermes's state.db (v0.14+).
 * Upserts so PatterStage has a unified view of all agent activity.
 *
 * For cron sessions, derives mission_id by matching the embedded
 * job ID in the session title against cron_jobs.external_job_id,
 * then resolving to missions.id via the missions.cron_job_id FK.
 *
 * Completed sessions in Hermes are updated to "completed"/"failed"
 * status here — their end state is always driven by Hermes.
 */

// Tracks the most recent orphan-close count so the periodic log can
// suppress the steady-state churn and only fire when the count changes
// meaningfully. Reset to null to log a fresh first-occurrence value.
// See audit Issue #3 (dogfood-output/report.md).
let lastOrphanCloseCount: number | null = null;

/**
 * Idempotent runtime check that the sessions.message_count column exists.
 *
 * The 006_sessions_message_count.sql migration adds it for fresh installs;
 * existing DBs that pre-date the migration are upgraded lazily the first
 * time a sync runs. Same pattern as profiles-tools-parity-ensure.
 */
function ensureMessageCountColumn(database: Database.Database): void {
  try {
    const col = database
      .prepare("SELECT 1 FROM pragma_table_info('sessions') WHERE name='message_count'")
      .get();
    if (!col) {
      database.exec("ALTER TABLE sessions ADD COLUMN message_count INTEGER");
    }
  } catch {
    // Non-fatal: the column will simply remain unavailable and the upsert
    // below will skip message_count via COALESCE handling.
  }
}

export function syncHermesSessionsToDb(): { synced: number; skipped: number } {
  const hermesSessions = readHermesSessionsFromStateDb();
  const missionIdByJobId = buildMissionIdByJobId();
  const validMissionIds = buildValidMissionIdSet();
  const database = getDb();
  ensureMessageCountColumn(database);
  // Cron-job names come from whichever module keeps them; Hermes stores them in
  // its own cron/jobs.json. Titling degrades to the first 8 chars of the job id
  // when no module supplies them, so an empty map is a valid answer, not a
  // failure (see formatSessionTitle).
  const cronJobsById = new Map(
    SERVER_MODULES.flatMap((m) => [...(m.loadAgentCronJobs?.() ?? [])]),
  );

  // ── Step 1: Clean up stale mission_id references ─────────────
  // NULL out mission_ids that point to soft-deleted or missing missions
  // to prevent FK violations on subsequent upserts.
  try {
    database.prepare(/* sql */ `
      UPDATE sessions
      SET mission_id = NULL
      WHERE source = 'cron'
        AND mission_id IS NOT NULL
        AND mission_id NOT IN (SELECT id FROM missions WHERE deleted_at IS NULL)
    `).run();
  } catch {
    // non-fatal — the individual try/catch below will handle any remaining FK issues
  }

  const upsert = database.prepare(/* sql */ `
    INSERT INTO sessions (
      id, agent_type, source, mission_id,
      model_id, provider, title, size, started_at, ended_at,
      status, exit_code, message_count
    ) VALUES (
      ?, 'hermes', ?, ?,
      ?, NULL, ?, ?, ?, ?,
      ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      source        = excluded.source,
      title         = excluded.title,
      model_id      = COALESCE(excluded.model_id, model_id),
      mission_id    = COALESCE(excluded.mission_id, mission_id),
      size          = excluded.size,
      started_at    = excluded.started_at,
      ended_at      = COALESCE(excluded.ended_at, ended_at),
      -- A session we've already closed locally (orphan sweep or a real
      -- end_reason) must NOT be resurrected to 'active' just because Hermes
      -- still reports end_reason: null. Without this guard the orphan sweep
      -- re-closes the same rows every 15s tick forever (active↔closed churn +
      -- write amplification). A real terminal end_reason (excluded.status is
      -- then 'completed'/'failed', not 'active') still flows through.
      status        = CASE
                         WHEN excluded.status = 'active'
                              AND sessions.status IN ('completed', 'failed', 'cancelled')
                           THEN sessions.status
                         ELSE excluded.status
                       END,
      exit_code     = COALESCE(excluded.exit_code, exit_code),
      message_count = COALESCE(excluded.message_count, message_count)
  `);

  const tx = database.transaction(() => {
    let synced = 0;
    let skipped = 0;
    for (const row of hermesSessions) {
      const startedAt = new Date(row.started_at * 1000).toISOString();
      const endedAt = row.ended_at
        ? new Date(row.ended_at * 1000).toISOString()
        : null;
      const { status, exitCode } = hermesStatusFromEndReason(row.end_reason);
      const size = estimateSessionSize(row.message_count, row.api_call_count);

      let title = row.title ?? row.id;
      let missionId: string | null = null;

      if (row.source === "cron") {
        // cron session id: cron_<jobid>_<date>_<time> — see parseCronSessionId.
        const parsed = parseCronSessionId(row.id);
        if (parsed) {
          const { jobId, rest } = parsed;
          // Prefer the cron job's human name from jobs.json over the raw jobId.
          // Falls back to the jobId prefix if the job isn't in jobs.json
          // (e.g. legacy entries from before the recurring mission was registered).
          const jobName = cronJobsById.get(jobId)?.name;
          const displayJob = jobName ? jobName : jobId.slice(0, 8);
          title = `Cron: ${displayJob} — ${rest.join(" ")}`;
          const candidateMissionId = missionIdByJobId.get(jobId) ?? null;
          // Only set mission_id if it exists in missions table (avoids FK violations)
          missionId =
            candidateMissionId && validMissionIds.has(candidateMissionId)
              ? candidateMissionId
              : null;
        }
      } else if (row.source === "api_server") {
        // api_server sessions mapped to api source
      }

      try {
        upsert.run(
          row.id,
          row.source === "api_server" ? "api" : row.source,
          missionId,
          row.model ?? null,
          title,
          size,
          startedAt,
          endedAt,
          status,
          exitCode,
          row.message_count ?? null,
        );
        synced++;
      } catch {
        // FK violation or other transient error — skip this session
        // so it doesn't kill the entire transaction
        skipped++;
      }
    }
    return { synced, skipped };
  });

  const result = tx();
  if (result.skipped > 0) {
    console.warn(`[syncHermesSessionsToDb] skipped ${result.skipped} sessions due to FK/constraint errors`);
  }

  // ── Step 3: Close orphaned active sessions ──────────────────
  // Two independent mechanisms protect the Sessions page from rows
  // stuck on "active" forever:
  //
  //   (A) Parent-mission status. If a session has a non-null
  //       mission_id and the parent mission has a terminal status
  //       (anything other than "dispatched"), the session's terminal
  //       state is derived from the mission: "successful" → "completed"
  //       (exit 0), "failed" → "failed" (exit 1), other → "completed"
  //       (exit 0, the parent is no longer running so it ended). This
  //       catches mission, cron, api, cli, discord, and telegram
  //       sessions uniformly — previously the sweep only covered
  //       cli/api, which left 33 mission + 202 cron + 57 discord + 43
  //       telegram rows permanently stuck.
  //
  //   (B) Age-based fallback. Sessions with no parent mission_id
  //       (e.g. Hermes CLI sessions that never went through a
  //       mission) are closed by age alone: started_at older than 5
  //       minutes (safely past any in-progress window) and size > 0
  //       (has actual content — empty sessions are probably still
  //       booting and shouldn't be closed prematurely).
  //
  // The 15s sync cycle re-runs these UPDATEs on every tick, so
  // without log suppression the message would fire ~4×/min with a
  // count that hovers between the same values forever (gateway
  // keeps re-inserting them as active on the next cycle's upsert).
  // Suppress the noise; only log on first occurrence and on a real
  // shift of >=100. Audit reference: dogfood-output/report.md Issue #3.
  try {
    const result = closeOrphanedActiveSessions(database, { log: true });
    void result; // logging side-effect captured in module-level state
  } catch {
    // non-fatal cleanup
  }

  return { synced: result.synced, skipped: result.skipped };
}

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
    const rows = database
      .prepare(/* sql */ `
        SELECT sessions.source,
               CASE
                 WHEN m.id IS NULL OR m.deleted_at IS NOT NULL THEN 'completed'
                 WHEN m.status = 'successful' THEN 'completed'
                 WHEN m.status IN ('failed', 'cancelled') THEN 'failed'
                 ELSE 'completed'
               END AS new_status
        FROM sessions
        LEFT JOIN missions m ON m.id = sessions.mission_id
        WHERE sessions.status = 'active'
          AND sessions.mission_id IS NOT NULL
          AND sessions.started_at < ?
          AND (m.id IS NULL OR m.deleted_at IS NOT NULL OR m.status != 'dispatched')
      `)
      .all(cutoff) as Array<{ source: string; new_status: string }>;
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
    const rows = database
      .prepare(/* sql */ `
        SELECT source
        FROM sessions
        WHERE status = 'active'
          AND mission_id IS NULL
          AND started_at < ?
          AND (size > 0 OR started_at < ?)
      `)
      .all(cutoff, longCutoff) as Array<{ source: string }>;
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
    const changedRows = database
      .prepare(/* sql */ `
        WITH session_with_mission AS (
          SELECT s.id AS session_id,
                 s.source AS source,
                 m.id AS mission_id,
                 m.status AS mission_status,
                 m.deleted_at AS mission_deleted_at
          FROM sessions s
          LEFT JOIN missions m ON m.id = s.mission_id
          WHERE s.status = 'active'
            AND s.mission_id IS NOT NULL
            AND s.started_at < ?
            AND (m.id IS NULL OR m.deleted_at IS NOT NULL OR m.status != 'dispatched')
        )
        UPDATE sessions
        SET status = CASE
              WHEN swm.mission_id IS NULL OR swm.mission_deleted_at IS NOT NULL THEN 'completed'
              WHEN swm.mission_status = 'successful' THEN 'completed'
              WHEN swm.mission_status IN ('failed', 'cancelled') THEN 'failed'
              ELSE 'completed'
            END,
            ended_at = COALESCE(sessions.ended_at, sessions.started_at),
            exit_code = COALESCE(
              sessions.exit_code,
              CASE
                WHEN swm.mission_id IS NULL OR swm.mission_deleted_at IS NOT NULL THEN 0
                WHEN swm.mission_status = 'successful' THEN 0
                WHEN swm.mission_status IN ('failed', 'cancelled') THEN 1
                ELSE 0
              END
            )
        FROM session_with_mission swm
        WHERE swm.session_id = sessions.id
        RETURNING sessions.source, sessions.status
      `)
      .all(cutoff) as Array<{ source: string; status: string }>;
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
    const changedRows = database
      .prepare(/* sql */ `
        UPDATE sessions
        SET status = 'completed',
            ended_at = COALESCE(ended_at, started_at)
        WHERE status = 'active'
          AND mission_id IS NULL
          AND started_at < ?
          AND (size > 0 OR started_at < ?)
        RETURNING source
      `)
      .all(cutoff, longCutoff) as Array<{ source: string }>;
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
