// ═══════════════════════════════════════════════════════════════
// retention/retention-law.ts · the declared facts about the readings tables
//
// WG-ARCH-008 declares `analytics_events` and `chat_messages` the READINGS
// class: each must name an owner, a consumer, a retention window and a prune
// path. This file is those declarations as code, with no IO, so the numbers can
// be unit-tested without a database. The same facts sit in migration 032's
// header and ADR-0009, deliberately, so the decision is legible from the
// schema, the code and the record alike.
//
// THE NUMBERS. A window exceeds the longest read any live consumer performs,
// with headroom for a machine switched off, and never goes below the floor.
// analytics_events: the longest bounded read is 365 days (`maxCountInSingleDay`,
// `countByTypeAndHour`, `countByHourAllTypes`), so 365 is the floor and 400 the
// window, five weeks for a closed laptop and a late prune. Its UNBOUNDED reads
// (`countByType`, `distinctActiveDays`, `distinctProfileCount`,
// `distinctEventTypeCount`) feed the achievements and the streak; no window
// satisfies them, so migration 031 captures the answer instead, and the prune
// refuses to run until it has. chat_messages: no windowed consumer exists, so
// the number is argued: a conversation idle for a year is beyond working reuse,
// and user-authored content is the one class where keeping LESS is the safer
// default. The floor of 30 catches a mistyped 3.
//
// THE SPLIT THRESHOLDS. RUL-ARCH-008 keeps one database until volume forces a
// split; these are where that becomes true, reported by the prune command so
// the seam is observable, and counted only with retention enabled and the table
// STILL growing. They sit where the lifetime aggregates start to hurt:
// `countByType` is an unindexed GROUP BY on every dashboard poll, and a million
// rows on the small always-on machines this targets is where a 20-second poll
// stops being free. `chat_messages` gets a quarter because its rows are one to
// three orders of magnitude larger, so a similar number of BYTES arrives sooner.
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
    owner: "src/lib/chat/chat-repository.ts",
    consumer: "the Chat surface (whole-conversation transcript) and run reconciliation",
    // No windowed consumer exists; recorded as 0 rather than invented, and the
    // floor below is what actually protects this table.
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
 * Whether a proposed window is legal, and why not. The CHECK constraints
 * enforce the same floors; this exists to fail with a sentence an operator can
 * act on instead of a SQLite constraint code.
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
