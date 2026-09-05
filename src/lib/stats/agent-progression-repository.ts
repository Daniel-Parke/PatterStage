// ═══════════════════════════════════════════════════════════════
// stats/agent-progression-repository.ts · the append-only per-Body record
//
// Every statement against `agent_progression_snapshots` lives here, and every
// one of them is an INSERT or a SELECT. That is not an accident of how much has
// been built yet. The table is append-only (WG-ARCH-003), so an UPDATE or a
// DELETE in this file would be the defect, and its absence is the first half of
// the guarantee.
//
// The second half is in migration 031: two BEFORE triggers that RAISE(ABORT) on
// any UPDATE or DELETE. This file could not mutate a row even if a later edit
// tried to, and `tests/unit/agent-progression-immutability.test.ts` proves that
// against real SQLite rather than asserting it in a comment.
//
// Reads and writes here do NOT swallow their errors, matching the discipline
// stated in agent-stats-repository.ts next door. The one caller,
// `captureAgentProgressionSnapshots`, owns the decision about what a failure
// means, and swallowing here would take that decision away from it and hide a
// refused write behind a zero.
// ═══════════════════════════════════════════════════════════════

import { getDb, inTransaction } from "@/lib/db";
import { getSchemaVersion } from "@/lib/db-schema";

/** One stored snapshot row, as written and as read back. */
export interface AgentProgressionSnapshotRow {
  id: number;
  profileSlug: string;
  capturedAt: string;
  level: number;
  levelTitle: string;
  xp: number;
  /** Names the subject of `achievementsJson`; see migration 031. */
  achievementsScope: string;
  achievementsJson: string;
  inputsJson: string;
  inputsDigest: string;
  schemaVersion: number;
  computationVersion: number;
}

/** The fields a caller supplies. `id`, `capturedAt` and `schemaVersion` are the database's to set. */
export type AgentProgressionSnapshotWrite = Omit<
  AgentProgressionSnapshotRow,
  "id" | "capturedAt" | "schemaVersion"
>;

interface RawRow {
  id: number;
  profile_slug: string;
  captured_at: string;
  level: number;
  level_title: string;
  xp: number;
  achievements_scope: string;
  achievements_json: string;
  inputs_json: string;
  inputs_digest: string;
  schema_version: number;
  computation_version: number;
}

function toRow(r: RawRow): AgentProgressionSnapshotRow {
  return {
    id: r.id,
    profileSlug: r.profile_slug,
    capturedAt: r.captured_at,
    level: r.level,
    levelTitle: r.level_title,
    xp: r.xp,
    achievementsScope: r.achievements_scope,
    achievementsJson: r.achievements_json,
    inputsJson: r.inputs_json,
    inputsDigest: r.inputs_digest,
    schemaVersion: r.schema_version,
    computationVersion: r.computation_version,
  };
}

/**
 * Append snapshot rows. The only write this table has.
 *
 * `schema_version` is read from the open database rather than passed in,
 * because it is a fact about the database and this is the layer that holds one.
 * The batch runs in a transaction so a capture across several profiles either
 * lands whole or not at all.
 */
export function insertAgentProgressionSnapshots(rows: AgentProgressionSnapshotWrite[]): number {
  if (rows.length === 0) return 0;
  return inTransaction(() => {
    const database = getDb();
    const schemaVersion = getSchemaVersion(database);
    const stmt = database.prepare(
      `INSERT INTO agent_progression_snapshots
         (profile_slug, level, level_title, xp, achievements_scope, achievements_json,
          inputs_json, inputs_digest, schema_version, computation_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const row of rows) {
      stmt.run(
        row.profileSlug,
        row.level,
        row.levelTitle,
        row.xp,
        row.achievementsScope,
        row.achievementsJson,
        row.inputsJson,
        row.inputsDigest,
        schemaVersion,
        row.computationVersion,
      );
    }
    return rows.length;
  });
}

/**
 * The newest row for each profile that has one.
 *
 * `MAX(id)` is the newest because ids are AUTOINCREMENT and nothing is ever
 * deleted, so a higher id is always a later capture. `captured_at` would tie on
 * two rows written in the same second; the id cannot.
 */
export function readLatestAgentProgressionSnapshots(): AgentProgressionSnapshotRow[] {
  const rows = getDb()
    .prepare(
      `SELECT s.* FROM agent_progression_snapshots s
         JOIN (SELECT profile_slug, MAX(id) AS newest
                 FROM agent_progression_snapshots GROUP BY profile_slug) latest
           ON s.profile_slug = latest.profile_slug AND s.id = latest.newest
        ORDER BY s.profile_slug`,
    )
    .all() as RawRow[];
  return rows.map(toRow);
}

/**
 * Every row recorded for one profile, oldest first: the audit trail.
 *
 * This is the read that makes the append-only design worth having. A single
 * "current" row would answer what the agent is; the history answers what it was
 * before the events behind it were pruned, which is the whole point.
 */
export function readAgentProgressionHistory(profileSlug: string): AgentProgressionSnapshotRow[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM agent_progression_snapshots WHERE profile_slug = ? ORDER BY id ASC`,
    )
    .all(profileSlug) as RawRow[];
  return rows.map(toRow);
}

/**
 * The instant of the newest capture anywhere in the table, or null when nothing
 * has ever been captured.
 *
 * THIS IS THE RETENTION PRUNE'S SAFETY INTERLOCK (ADR-0009), which is why it
 * lives with the table it reads rather than in the retention repository. The
 * prune may only delete rows that are older than this instant, because those are
 * the rows a capture has already seen and folded into a recorded answer.
 *
 * MAX over the whole table, not per profile, is the right question for that use.
 * The achievements half of a row is computed install-wide (`achievements_scope`
 * says so), so whichever profile happened to move last carries the newest
 * install-wide measurements, and that is the guarantee the prune needs. A
 * per-profile watermark would answer a question about level and XP, which are
 * derived from `runs` and are not at risk from this prune at all.
 *
 * `captured_at` is written by the column DEFAULT `datetime('now')`, the same
 * format `retentionCutoff` produces, so the two compare directly as strings.
 */
export function readNewestProgressionCapture(): string | null {
  const row = getDb()
    .prepare(`SELECT MAX(captured_at) AS newest FROM agent_progression_snapshots`)
    .get() as { newest: string | null } | undefined;
  return row?.newest ?? null;
}
