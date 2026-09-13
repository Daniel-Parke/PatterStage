// ═══════════════════════════════════════════════════════════════
// session-sync.ts: the upsert pipeline, agent state.db to sessions
//
// The pipeline, run on the 15s sessions sync cycle (SessionSync) and on
// demand via `listSessions({ syncIfActive })`:
//
//   read rows → resolve mission links → title → upsert → sweep
//
// ../runtime/state-db reads the agent's own state.db (a foreign
// database, hence an adapter rather than a repository); every statement
// this pipeline runs against PatterStage's own `sessions` table is in
// ./session-sync-repository.
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
import { messageFromError } from "@/lib/api/api-fetch";
import { readHermesSessionsFromStateDb } from "../runtime/state-db";
import { hermesStatusFromEndReason } from "./hermes-state-sessions";
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

/** At most this many row-level causes are carried into the log line. */
const MAX_SKIP_SAMPLES = 3;

/**
 * Suppression keyed on the CAUSE, not on the count.
 *
 * Modelled on ConfigSync's `lastYamlErrorSignature` rather than on the orphan
 * sweep's magnitude rule, and the difference matters: the sweep watches a count
 * oscillating around a steady state, while here the interesting variable is what
 * is going wrong. Keying on the error text means a stable pair of broken rows
 * logs once instead of four times a minute forever, and a NEW failure mode is
 * news immediately rather than being swallowed by a count that did not move.
 *
 * Row ids and digits are stripped from the signature, so two rows failing the
 * same way and forty-seven rows failing the same way are one signature.
 */
let lastSkipSignature: string | null = null;

function reportSkips(skipped: number, samples: string[]): void {
  if (skipped === 0) {
    if (lastSkipSignature !== null) {
      // The drained transition. Without it the log simply stops, and an operator
      // cannot tell "it cleared" from "the sync died".
      console.warn("[syncHermesSessionsToDb] session skips cleared");
      lastSkipSignature = null;
    }
    return;
  }

  const signature = [...new Set(samples.map((s) => s.replace(/\d+/g, "#")))].sort().join(" | ");
  if (signature === lastSkipSignature) return;
  lastSkipSignature = signature;

  // WARN, not ERROR. The sync SUCCEEDED; some rows were skipped. Logging this
  // through logApiError said "Error" four times a minute for a stable,
  // non-actionable condition, which is how it trained an operator's watchdog to
  // treat this file as noise.
  console.warn(
    `[syncHermesSessionsToDb] skipped ${skipped} session(s). ` +
      `Causes (up to ${MAX_SKIP_SAMPLES}): ${samples.join(" | ")}`,
  );
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
    clearStaleCronMissionLinks(database);
  } catch {
    // non-fatal — the individual try/catch below will handle any remaining FK issues
  }

  const upsert = prepareSessionUpsert(database);

  const tx = database.transaction(() => {
    let synced = 0;
    let skipped = 0;
    const skipSamples: string[] = [];
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
      } catch (err) {
        // Capture the CAUSE. A bare `catch { skipped++ }` here meant neither the
        // log nor anyone reading it could say which rows failed or why, and the
        // summary below asserted "FK/constraint errors", a cause the code had
        // never observed. The two realistic causes are neither: a NaN `size`
        // bound as NULL against a NOT NULL column, and a better-sqlite3 bind
        // TypeError (T-0064).
        skipped++;
        if (skipSamples.length < MAX_SKIP_SAMPLES) {
          skipSamples.push(`${row.id}: ${messageFromError(err, "unknown error")}`);
        }
      }
    }
    return { synced, skipped, samples: skipSamples };
  });

  const result = tx();
  reportSkips(result.skipped, result.samples);

  // ── Step 3: Close orphaned active sessions ──────────────────
  // Two mechanisms, both in ./session-orphan-sweep: (A) a session with a
  // mission_id takes its terminal state from the parent mission, which is
  // what freed the 33 mission + 202 cron + 57 discord + 43 telegram rows
  // the cli/api-only sweep had left stuck on "active"; (B) parentless
  // sessions close by age alone. The 15s cycle re-runs the UPDATEs every
  // tick, so the log is suppressed to first occurrence and shifts of
  // >=100; that state lives in the sweep. Audit reference:
  // dogfood-output/report.md Issue #3.
  try {
    const result = closeOrphanedActiveSessions(database, { log: true });
    void result; // logging side-effect captured in module-level state
  } catch {
    // non-fatal cleanup
  }

  return { synced: result.synced, skipped: result.skipped };
}
