// ═══════════════════════════════════════════════════════════════
// retention/retention-law.ts · the declared facts about the readings tables
//
// WG-ARCH-008 declares `analytics_events` and `chat_messages` the READINGS
// class: append-only, growing with use, and therefore required to name an owner,
// a consumer, a retention window and a prune path. This file is those
// declarations as code, with no IO in it, so the numbers can be read, argued
// with and unit-tested without opening a database.
//
// The same facts are written into migration 032's header and into ADR-0009. That
// is deliberate duplication of a decision that has to be legible from three
// different starting points: the schema, the code and the decision record.
//
// ── WHY EACH NUMBER IS THE NUMBER ──────────────────────────────
//
// The rule, stated once and applied twice: a window is longer than the longest
// read any live consumer performs, with headroom for a machine that was switched
// off, and it is never shorter than the floor.
//
// analytics_events. The longest bounded read in the codebase is 365 days
// (`maxCountInSingleDay`, `countByTypeAndHour` and `countByHourAllTypes` each
// default `sinceDays = 365`); the Insights page offers 7, 30 and 90. So a window
// under 365 makes a live chart show a smaller answer than it showed yesterday,
// and 365 is the floor. The shipped window is 400: 365 plus five weeks, which
// absorbs a laptop that was closed for a month and a prune that runs late
// without ever clipping the edge of a 365-day read.
//
// The UNBOUNDED reads over the same table are the interesting case, and they are
// the reason migration 031 exists rather than a reason for a longer window.
// `countByType`, `distinctActiveDays`, `distinctProfileCount` and
// `distinctEventTypeCount` are lifetime aggregates feeding the achievements and
// the daily streak: no finite window satisfies them, so they are satisfied by
// capturing the answer instead of by keeping the inputs. The prune refuses to
// run unless that capture has happened.
//
// chat_messages. There is no windowed consumer to derive a number from: the
// reader is the transcript, which is unbounded by construction. So the number is
// argued rather than measured, and the argument is that a conversation with no
// activity for a full year is beyond any working reuse. It is also user-authored
// content, the one class where keeping LESS is the safer default rather than the
// riskier one, which is why the argued number is not longer. The floor of 30
// days exists to catch a mistyped 3.
//
// ── THE SPLIT THRESHOLDS ───────────────────────────────────────
//
// RUL-ARCH-008 keeps one database until volume forces a split. These are the
// numbers at which "volume forced it" becomes true, and they are reported by the
// prune command so the seam is observable rather than decorative.
//
// Retention is the cheap answer and is tried first, so a threshold only counts
// when the policy is already enabled and the table is STILL growing. The numbers
// are set where the lifetime aggregates start to hurt: `countByType` is an
// unindexed GROUP BY over the whole table on every dashboard poll, and a million
// rows of that on the small always-on machines this product targets is where a
// 20-second poll stops being free. `chat_messages` gets a quarter of the count
// because its rows are one to three orders of magnitude larger (content,
// reasoning and tool_calls_json), so a similar number of BYTES arrives sooner.
// ═══════════════════════════════════════════════════════════════

/** The two tables WG-ARCH-008 declares as readings. Order is the prune order. */
export const RETENTION_TABLES = ["analytics_events", "chat_messages"] as const;

export type RetentionTable = (typeof RETENTION_TABLES)[number];

/** Everything WG-ARCH-008 requires a readings table to declare. */
export interface RetentionDeclaration {
  table: RetentionTable;
  /** The one module that writes rows into it. */
  owner: string;
  /** Who reads it, and therefore who a too-short window would hurt. */
  consumer: string;
  /** The longest bounded read any live consumer performs, in days. */
  longestConsumerReadDays: number;
  /** The shortest window the schema's CHECK constraint will accept. */
  floorDays: number;
  /** The window shipped to every install, disabled. */
  defaultDays: number;
  /** Row count at which the WG-ARCH-008 physical split becomes due. */
  splitThresholdRows: number;
}

export const RETENTION_LAW: Record<RetentionTable, RetentionDeclaration> = {
  analytics_events: {
    table: "analytics_events",
    owner: "src/lib/analytics/analytics-repository.ts",
    consumer:
      "GET /api/analytics (Insights) and src/lib/stats/stats-repository.ts (achievements, streak)",
    longestConsumerReadDays: 365,
    floorDays: 365,
    defaultDays: 400,
    splitThresholdRows: 1_000_000,
  },
  chat_messages: {
    table: "chat_messages",
    owner: "src/lib/chat-repository.ts",
    consumer: "the Chat surface (whole-conversation transcript) and run reconciliation",
    // No windowed consumer exists; the transcript read is unbounded. Recorded as
    // 0 rather than invented, because a fabricated measurement is worse than an
    // honest absence, and the floor below is what actually protects this table.
    longestConsumerReadDays: 0,
    floorDays: 30,
    defaultDays: 365,
    splitThresholdRows: 250_000,
  },
};

export function isRetentionTable(value: string): value is RetentionTable {
  return (RETENTION_TABLES as readonly string[]).includes(value);
}

/**
 * Whether a proposed window is legal, and why not when it is not.
 *
 * The database enforces the same floors with CHECK constraints, so this cannot
 * be the only guard and is not meant to be: it exists to fail with a sentence an
 * operator can act on instead of a SQLite constraint code.
 */
export function validateRetainDays(
  table: RetentionTable,
  days: number,
): { ok: true } | { ok: false; reason: string } {
  const law = RETENTION_LAW[table];
  if (!Number.isInteger(days)) {
    return { ok: false, reason: `retain_days must be a whole number of days, got ${days}` };
  }
  if (days < law.floorDays) {
    const because =
      law.longestConsumerReadDays > 0
        ? `its consumers read up to ${law.longestConsumerReadDays} days back`
        : "shorter than a month cannot mean the operator no longer needs it";
    return {
      ok: false,
      reason: `${table} keeps a minimum of ${law.floorDays} days (${because}); ${days} was requested`,
    };
  }
  return { ok: true };
}
