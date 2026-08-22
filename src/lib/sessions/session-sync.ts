// ═══════════════════════════════════════════════════════════════
// session-sync.ts: the upsert pipeline, agent state.db to sessions
//
// Split out of session-repository.ts (which is pure CRUD), then split
// again by responsibility. What is left here is the pipeline itself,
// run on the 15s sessions sync cycle (SessionSync) and on demand via
// `listSessions({ syncIfActive })`:
//
//   read rows → resolve mission links → title → upsert → sweep
//
// The three pieces it orchestrates each own their own file:
//   - ./hermes-state-sessions, which reads the agent's state.db and
//     translates its end_reason vocabulary.
//   - ./session-mission-links, which resolves a session to its parent
//     mission (bulk shape, used once per tick).
//   - ./session-orphan-sweep, which closes rows the agent will never
//     report an end for. Called once, at the tail.
//
// It depends on session-repository only for the pure `estimateSessionSize`
// helper, a one-directional edge. The repository imports
// `syncHermesSessionsToDb` back, but only from inside `listSessions`
// (a function-level reference), so there's no module-init cycle.
//
// `ensureMessageCountColumn` below is a sanctioned exception to the
// "schema changes go through the migration chain" rule; operator
// ruling D6 (2026-08-22) keeps it. Read its own comment before
// touching it.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";

import { getDb } from "../db";
import { SERVER_MODULES } from "../modules/server";
import { parseCronSessionId } from "./session-title";
import { estimateSessionSize } from "./session-repository";
import {
  hermesStatusFromEndReason,
  readHermesSessionsFromStateDb,
} from "./hermes-state-sessions";
import {
  buildMissionIdByJobId,
  buildValidMissionIdSet,
} from "./session-mission-links";
import { closeOrphanedActiveSessions } from "./session-orphan-sweep";
import {
  addSessionMessageCountColumn,
  clearStaleCronMissionLinks,
  hasSessionMessageCountColumn,
  prepareSessionUpsert,
} from "./session-sync-repository";

/**
 * Idempotent runtime check that the sessions.message_count column exists.
 *
 * The 006_sessions_message_count.sql migration adds it for fresh installs;
 * existing DBs that pre-date the migration are upgraded lazily the first
 * time a sync runs. Same pattern as profiles-tools-parity-ensure.
 *
 * This is deliberate self-heal, not debt: operator ruling D6 (2026-08-22)
 * keeps it. It is paired with migration 006 and repaired by
 * apply-legacy-column-repair, and the pragma guard means a database that
 * already has the column pays one cheap read and nothing else.
 */
function ensureMessageCountColumn(database: Database.Database): void {
  try {
    if (!hasSessionMessageCountColumn(database)) {
      addSessionMessageCountColumn(database);
    }
  } catch {
    // Non-fatal: the column will simply remain unavailable and the upsert
    // below will skip message_count via COALESCE handling.
  }
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
    clearStaleCronMissionLinks(database);
  } catch {
    // non-fatal — the individual try/catch below will handle any remaining FK issues
  }

  const upsert = prepareSessionUpsert(database);

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
        upsert({
          id: row.id,
          source: row.source === "api_server" ? "api" : row.source,
          missionId,
          modelId: row.model ?? null,
          title,
          size,
          startedAt,
          endedAt,
          status,
          exitCode,
          messageCount: row.message_count ?? null,
        });
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
  // shift of >=100. The suppression state lives in
  // ./session-orphan-sweep. Audit reference: dogfood-output/report.md
  // Issue #3.
  try {
    const result = closeOrphanedActiveSessions(database, { log: true });
    void result; // logging side-effect captured in module-level state
  } catch {
    // non-fatal cleanup
  }

  return { synced: result.synced, skipped: result.skipped };
}
