// ═══════════════════════════════════════════════════════════════
// sessions/session-sync-repository.ts — the statements behind the
// sessions sync pipeline
//
// Three files used to prepare their own SQL: session-sync.ts (the
// upsert pipeline), session-mission-links.ts (which mission does this
// session belong to) and session-orphan-sweep.ts (close the rows the
// agent will never report an end for). Between them they knew the
// column list of `sessions`, the missions/cron_jobs join path, and the
// exact predicates the sweep's dry run has to mirror. All of that is
// one table shape's business, so it lives in one file.
//
// Two things are preserved deliberately and must stay that way:
//
//   - Nothing here swallows an error. Every caller already wraps these
//     in a try/catch that degrades to "nothing learned this tick", and
//     the sweep's preview and write must fail the SAME way for the
//     `preview === actual` parity test to mean anything.
//   - The sweep's dry-run SELECTs mirror the write's UPDATE predicates
//     exactly. They sit next to each other here so a change to one is
//     visibly a change to the other.
//
// This file does NOT read the agent's own state.db. That is a foreign
// database and belongs to the runtime adapter (src/lib/runtime/state-db.ts).
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";

import { getDb } from "../db";

// ── sessions.message_count self-heal (operator ruling D6) ────

/** Whether the `sessions.message_count` column exists on this database. */
export function hasSessionMessageCountColumn(database: Database.Database): boolean {
  const col = database
    .prepare("SELECT 1 FROM pragma_table_info('sessions') WHERE name='message_count'")
    .get();
  return Boolean(col);
}

/** Add the `sessions.message_count` column (the lazy upgrade for pre-006 databases). */
export function addSessionMessageCountColumn(database: Database.Database): void {
  database.exec("ALTER TABLE sessions ADD COLUMN message_count INTEGER");
}

// ── The upsert pipeline ──────────────────────────────────────

/** Null out cron mission_ids that point at soft-deleted or missing missions. */
export function clearStaleCronMissionLinks(database: Database.Database): void {
  database.prepare(/* sql */ `
      UPDATE sessions
      SET mission_id = NULL
      WHERE source = 'cron'
        AND mission_id IS NOT NULL
        AND mission_id NOT IN (SELECT id FROM missions WHERE deleted_at IS NULL)
    `).run();
}

/** One agent session, translated into the columns the `sessions` table stores. */
export interface SessionUpsertInput {
  id: string;
  source: string;
  missionId: string | null;
  modelId: string | null;
  title: string;
  size: number;
  startedAt: string;
  endedAt: string | null;
  status: string;
  exitCode: number | null;
  messageCount: number | null;
}

/**
 * Prepare the sessions upsert once and return a runner for it.
 *
 * The pipeline runs this inside its own transaction, several thousand
 * times on a large state.db, so the statement is prepared once and
 * reused; a function that prepared per row would be a real regression.
 * Returning a runner rather than the better-sqlite3 statement keeps the
 * column list and the parameter ORDER on this side of the seam.
 */
export function prepareSessionUpsert(
  database: Database.Database,
): (input: SessionUpsertInput) => void {
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

  return (input: SessionUpsertInput) => {
    upsert.run(
      input.id,
      input.source,
      input.missionId,
      input.modelId,
      input.title,
      input.size,
      input.startedAt,
      input.endedAt,
      input.status,
      input.exitCode,
      input.messageCount,
    );
  };
}

// ── Session to mission links ─────────────────────────────────

/** Every mission id, soft-deleted included (the FK only checks existence). */
export function readAllMissionIds(): Array<{ id: string }> {
  return getDb().prepare("SELECT id FROM missions").all() as Array<{ id: string }>;
}

/** Mission id paired with the agent job id that spawned it, for every linked cron mission. */
export function readMissionIdsByExternalJobId(): Array<{
  mission_id: string;
  external_job_id: string;
}> {
  return getDb()
    .prepare(`
        SELECT m.id AS mission_id, c.external_job_id
        FROM missions m
        JOIN cron_jobs c ON c.id = m.cron_job_id
        WHERE c.external_job_id IS NOT NULL AND c.external_job_id != ''
      `)
    .all() as Array<{ mission_id: string; external_job_id: string }>;
}

/** The mission registered for one agent cron job id, or undefined. */
export function readMissionIdForExternalJobId(
  externalJobId: string,
): { mission_id: string } | undefined {
  return getDb()
    .prepare(
      `SELECT m.id AS mission_id
         FROM missions m
         JOIN cron_jobs c ON c.id = m.cron_job_id
         WHERE c.external_job_id = ?
         LIMIT 1`,
    )
    .get(externalJobId) as { mission_id: string } | undefined;
}

// ── Orphan sweep: the dry run ────────────────────────────────

/**
 * (A) Active sessions with a parent mission that is no longer running,
 * with the status each would receive. LEFT JOIN so missing and
 * soft-deleted parents match too.
 */
export function selectMissionGatedOrphans(
  database: Database.Database,
  cutoff: string,
): Array<{ source: string; new_status: string }> {
  return database
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
}

/** (B) Active sessions with no parent mission, gated on size or age. */
export function selectParentlessOrphans(
  database: Database.Database,
  cutoff: string,
  longCutoff: string,
): Array<{ source: string }> {
  return database
    .prepare(/* sql */ `
        SELECT source
        FROM sessions
        WHERE status = 'active'
          AND mission_id IS NULL
          AND started_at < ?
          AND (size > 0 OR started_at < ?)
      `)
    .all(cutoff, longCutoff) as Array<{ source: string }>;
}

// ── Orphan sweep: the write ──────────────────────────────────

/**
 * (A) Close the mission-gated orphans, deriving each session's terminal
 * status and exit code from its parent. RETURNING gives the rows THIS
 * call changed, so a tally cannot double-count across sync ticks.
 */
export function closeMissionGatedOrphans(
  database: Database.Database,
  cutoff: string,
): Array<{ source: string; status: string }> {
  return database
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
}

/** (B) Close the parentless orphans. Always 'completed' — the SQL has no CASE branch. */
export function closeParentlessOrphans(
  database: Database.Database,
  cutoff: string,
  longCutoff: string,
): Array<{ source: string }> {
  return database
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
}
