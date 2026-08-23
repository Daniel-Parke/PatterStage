// ═══════════════════════════════════════════════════════════════
// retention/retention-repository.ts · every statement the prune runs
//
// This is the only file in src/lib/retention/ that contains SQL, which is
// WG-ARCH-002 applied to the one feature where a stray DELETE in the wrong layer
// would be unrecoverable. `retention-prune.ts` next door decides WHETHER to
// delete and reads no table itself.
//
// ── THREE THINGS TO KNOW BEFORE EDITING ANYTHING HERE ──────────
//
// 1. TIMESTAMPS ARE NOT ALL THE SAME SHAPE. `analytics_events.created_at` comes
//    from the column DEFAULT `datetime('now')` and looks like
//    "2026-08-23 10:00:00". `chat_messages.created_at` is written by the
//    repository from `new Date().toISOString()` and looks like
//    "2026-08-23T10:00:00.000Z". Those two do NOT compare correctly as strings
//    within a day, so every comparison below goes through SQLite's `datetime()`,
//    which normalises both to the first form. It costs the index on
//    `created_at`; a maintenance command an operator invokes by hand can afford a
//    scan, and a boundary that is right only on most days cannot.
//
//    `datetime()` returns NULL for a value it cannot parse, and `NULL < cutoff`
//    is NULL, not true. In `analytics_events`, which is compared row by row, an
//    unparseable timestamp is therefore KEPT, which is the correct direction for
//    the one operation in this product that cannot be undone.
//
//    Say it precisely, because it is not true of both tables. `chat_messages` is
//    pruned by CONVERSATION, through `MAX(datetime(created_at))`, and SQL `MAX()`
//    IGNORES NULLs. So a single unparseable message inside a conversation whose
//    other messages are all cold does NOT save it: the conversation goes. That is
//    unreachable today, because every row is written with
//    `new Date().toISOString()`, and it is written down here so a future writer
//    that is looser about the format knows what it would be changing.
//
// 2. THE CUTOFF IS COMPUTED BY SQLITE, not by JavaScript. `retentionCutoff` asks
//    the same engine that will evaluate the comparison, in the same format, so
//    there is no timezone or formatting gap between deciding the boundary and
//    applying it. It is also the string written into `retention_prune_runs`, so
//    the record says exactly which boundary ran.
//
// 3. CHAT IS PRUNED BY CONVERSATION, NEVER BY MESSAGE. Deleting messages older
//    than a cutoff out of a live conversation leaves a transcript that begins in
//    the middle, which is worse than either keeping it or dropping it. So the
//    unit is a conversation whose LAST activity is before the cutoff, and every
//    message it holds is older than that, so nothing newer than the window is
//    ever touched. The messages go by ON DELETE CASCADE, and the delete verifies
//    that the cascade actually happened rather than assuming the pragma.
// ═══════════════════════════════════════════════════════════════

import { getDb, inTransaction } from "@/lib/db";
import { RETENTION_TABLES, type RetentionTable } from "./retention-law";

/** One declared policy row, as stored by migration 032. */
export interface RetentionPolicyRow {
  table: RetentionTable;
  owner: string;
  consumer: string;
  enabled: boolean;
  retainDays: number;
  updatedAt: string;
}

/** One append-only record of an applied prune. */
export interface RetentionPruneRunRow {
  id: number;
  ranAt: string;
  table: string;
  outcome: string;
  retainDays: number;
  cutoff: string;
  rowsMatched: number;
  rowsDeleted: number;
  progressionWatermark: string | null;
  detail: string;
}

interface RawPolicy {
  table_name: string;
  owner: string;
  consumer: string;
  enabled: number;
  retain_days: number;
  updated_at: string;
}

interface RawPruneRun {
  id: number;
  ran_at: string;
  table_name: string;
  outcome: string;
  retain_days: number;
  cutoff: string;
  rows_matched: number;
  rows_deleted: number;
  progression_watermark: string | null;
  detail: string;
}

function toPolicy(r: RawPolicy): RetentionPolicyRow {
  return {
    table: r.table_name as RetentionTable,
    owner: r.owner,
    consumer: r.consumer,
    enabled: r.enabled === 1,
    retainDays: r.retain_days,
    updatedAt: r.updated_at,
  };
}

// ── Policy ────────────────────────────────────────────────────

/** Every declared policy row, in the order the tables are pruned. */
export function readRetentionPolicies(): RetentionPolicyRow[] {
  const rows = getDb()
    .prepare(`SELECT * FROM retention_policy`)
    .all() as RawPolicy[];
  const byTable = new Map(rows.map((r) => [r.table_name, toPolicy(r)]));
  return RETENTION_TABLES.map((t) => byTable.get(t)).filter(
    (r): r is RetentionPolicyRow => r !== undefined,
  );
}

/** One policy row, or null when migration 032 has not seeded it. */
export function readRetentionPolicy(table: RetentionTable): RetentionPolicyRow | null {
  const row = getDb()
    .prepare(`SELECT * FROM retention_policy WHERE table_name = ?`)
    .get(table) as RawPolicy | undefined;
  return row ? toPolicy(row) : null;
}

/**
 * Turn a policy on or off, and optionally move its window.
 *
 * The window's floor is a CHECK constraint in migration 032, so a value below it
 * throws here rather than being written. `validateRetainDays` in retention-law.ts
 * exists to say the same thing in a sentence first; this is the one that binds.
 */
export function setRetentionPolicy(
  table: RetentionTable,
  updates: { enabled?: boolean; retainDays?: number },
): void {
  inTransaction(() => {
    const database = getDb();
    if (updates.enabled !== undefined) {
      database
        .prepare(
          `UPDATE retention_policy SET enabled = ?, updated_at = datetime('now')
             WHERE table_name = ?`,
        )
        .run(updates.enabled ? 1 : 0, table);
    }
    if (updates.retainDays !== undefined) {
      database
        .prepare(
          `UPDATE retention_policy SET retain_days = ?, updated_at = datetime('now')
             WHERE table_name = ?`,
        )
        .run(updates.retainDays, table);
    }
  });
}

// ── The boundary ──────────────────────────────────────────────

/** The cutoff instant for a window, in SQLite's own format. Rows strictly older go. */
export function retentionCutoff(retainDays: number): string {
  const row = getDb()
    .prepare(`SELECT datetime('now', ?) AS cutoff`)
    .get(`-${Math.max(0, Math.floor(retainDays))} days`) as { cutoff: string };
  return row.cutoff;
}

// ── Volume, for the WG-ARCH-008 split threshold ───────────────

/**
 * Current row count for a readings table.
 *
 * The SQL is selected from a literal map rather than built by interpolating the
 * table name. The type already restricts the argument to two values; this makes
 * it true of the string that reaches SQLite as well.
 */
const COUNT_ALL_SQL: Record<RetentionTable, string> = {
  analytics_events: `SELECT COUNT(*) AS c FROM analytics_events`,
  chat_messages: `SELECT COUNT(*) AS c FROM chat_messages`,
};

export function countRetentionTableRows(table: RetentionTable): number {
  const row = getDb().prepare(COUNT_ALL_SQL[table]).get() as { c: number } | undefined;
  return row?.c ?? 0;
}

const OLDEST_SQL: Record<RetentionTable, string> = {
  analytics_events: `SELECT MIN(datetime(created_at)) AS oldest FROM analytics_events`,
  chat_messages: `SELECT MIN(datetime(created_at)) AS oldest FROM chat_messages`,
};

/** The oldest row's timestamp, or null on an empty table. */
export function readOldestRetentionRow(table: RetentionTable): string | null {
  const row = getDb().prepare(OLDEST_SQL[table]).get() as { oldest: string | null } | undefined;
  return row?.oldest ?? null;
}

// ── analytics_events ──────────────────────────────────────────

export function countAnalyticsEventsBefore(cutoff: string): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM analytics_events WHERE datetime(created_at) < ?`)
    .get(cutoff) as { c: number } | undefined;
  return row?.c ?? 0;
}

export function deleteAnalyticsEventsBefore(cutoff: string): number {
  return inTransaction(
    () =>
      getDb()
        .prepare(`DELETE FROM analytics_events WHERE datetime(created_at) < ?`)
        .run(cutoff).changes,
  );
}

// ── chat_messages, by conversation ────────────────────────────

/**
 * The conversations whose LAST activity is before the cutoff.
 *
 * COALESCE gives a conversation with no messages its own `updated_at`, so an
 * abandoned empty thread is still reachable by the prune. When neither value
 * parses, the expression is NULL, the comparison is NULL, and the conversation
 * is kept.
 */
const EXPIRED_CONVERSATION_IDS = `
  SELECT c.id AS id
    FROM chat_conversations c
    LEFT JOIN chat_messages m ON m.conversation_id = c.id
   GROUP BY c.id
  HAVING COALESCE(MAX(datetime(m.created_at)), datetime(c.updated_at)) < ?
`;

/** Messages that would go with their conversations. */
export function countExpiredChatMessages(cutoff: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM chat_messages
         WHERE conversation_id IN (${EXPIRED_CONVERSATION_IDS})`,
    )
    .get(cutoff) as { c: number } | undefined;
  return row?.c ?? 0;
}

/** Conversations that would go. */
export function countExpiredChatConversations(cutoff: string): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM (${EXPIRED_CONVERSATION_IDS})`)
    .get(cutoff) as { c: number } | undefined;
  return row?.c ?? 0;
}

/**
 * Delete the expired conversations, taking their messages with them.
 *
 * The orphan check is the point. `ON DELETE CASCADE` only fires when
 * `foreign_keys` is ON, and a conversation deleted without its messages is a
 * corrupted transcript rather than a partial success, so a surviving orphan
 * throws and the transaction rolls back. Refusing to half-delete is the whole
 * posture of this feature.
 */
export function deleteExpiredChatConversations(cutoff: string): {
  conversations: number;
  messages: number;
} {
  return inTransaction(() => {
    const database = getDb();
    const messages = countExpiredChatMessages(cutoff);
    const conversations = database
      .prepare(`DELETE FROM chat_conversations WHERE id IN (${EXPIRED_CONVERSATION_IDS})`)
      .run(cutoff).changes;

    const orphans = (
      database
        .prepare(
          `SELECT COUNT(*) AS c FROM chat_messages
             WHERE conversation_id NOT IN (SELECT id FROM chat_conversations)`,
        )
        .get() as { c: number }
    ).c;
    if (orphans > 0) {
      throw new Error(
        `retention: ${orphans} chat message(s) were left without a conversation, ` +
          `which means ON DELETE CASCADE did not fire (PRAGMA foreign_keys is OFF). ` +
          `The prune has been rolled back and nothing was deleted.`,
      );
    }

    return { conversations, messages };
  });
}

// ── The deletion record ───────────────────────────────────────

export interface RetentionPruneRunWrite {
  table: string;
  outcome: string;
  retainDays: number;
  cutoff: string;
  rowsMatched: number;
  rowsDeleted: number;
  progressionWatermark: string | null;
  detail: string;
}

/**
 * Append one prune record. The table is append-only, enforced by two triggers in
 * migration 032, so this is the only statement that may ever touch it.
 */
export function insertRetentionPruneRun(row: RetentionPruneRunWrite): void {
  getDb()
    .prepare(
      `INSERT INTO retention_prune_runs
         (table_name, outcome, retain_days, cutoff, rows_matched, rows_deleted,
          progression_watermark, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.table,
      row.outcome,
      row.retainDays,
      row.cutoff,
      row.rowsMatched,
      row.rowsDeleted,
      row.progressionWatermark,
      row.detail,
    );
}

/** The most recent prune records, newest first. */
export function readRetentionPruneRuns(limit = 20): RetentionPruneRunRow[] {
  const rows = getDb()
    .prepare(`SELECT * FROM retention_prune_runs ORDER BY id DESC LIMIT ?`)
    .all(Math.max(1, Math.floor(limit))) as RawPruneRun[];
  return rows.map((r) => ({
    id: r.id,
    ranAt: r.ran_at,
    table: r.table_name,
    outcome: r.outcome,
    retainDays: r.retain_days,
    cutoff: r.cutoff,
    rowsMatched: r.rows_matched,
    rowsDeleted: r.rows_deleted,
    progressionWatermark: r.progression_watermark,
    detail: r.detail,
  }));
}
