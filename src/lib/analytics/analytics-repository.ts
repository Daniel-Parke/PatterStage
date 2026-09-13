// ═══════════════════════════════════════════════════════════════
// analytics/analytics-repository.ts — read/write for analytics_events
//
// insertEvent is the only write (called via recordEvent). Everything else is a
// read aggregation for the Insights page + the derived achievements. Every read
// is defensive (try/catch → empty/zero) so a fresh or pre-v12 DB yields zeros,
// not errors — same discipline as stats-repository.ts.
// ═══════════════════════════════════════════════════════════════

import { getDb, inTransaction, uuid } from "../db";
import type { AnalyticsEventType, AnalyticsEntityType } from "./event-types";

export interface InsertEventInput {
  eventType: AnalyticsEventType;
  entityType?: AnalyticsEntityType | null;
  entityId?: string | null;
  profile?: string | null;
  metadataJson?: string | null;
}

/** Append one event. created_at uses the column DEFAULT (datetime('now')). */
export function insertEvent(input: InsertEventInput): void {
  inTransaction(() => {
    getDb()
      .prepare(
        `INSERT INTO analytics_events (id, event_type, entity_type, entity_id, profile, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        uuid(),
        input.eventType,
        input.entityType ?? null,
        input.entityId ?? null,
        input.profile ?? null,
        input.metadataJson ?? null,
      );
  });
}

function safeRead<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Clamp to a non-negative integer for safe `'-N days'` interpolation. */
function days(n: number): string {
  return `-${Math.max(0, Math.floor(n))} days`;
}

/** Build the last `n` UTC dates (YYYY-MM-DD), oldest first, including today. */
function lastNDates(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function groupCounts(rows: { event_type: string; c: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.event_type] = r.c;
  return out;
}

/** Total count per event_type, all time. */
export function countByType(): Record<string, number> {
  return safeRead(
    () =>
      groupCounts(
        getDb()
          .prepare(`SELECT event_type, COUNT(*) AS c FROM analytics_events GROUP BY event_type`)
          .all() as { event_type: string; c: number }[],
      ),
    {},
  );
}

/** Count per event_type within the last `sinceDays` days. */
export function countByTypeSince(sinceDays: number): Record<string, number> {
  return safeRead(
    () =>
      groupCounts(
        getDb()
          .prepare(
            `SELECT event_type, COUNT(*) AS c FROM analytics_events
             WHERE created_at >= datetime('now', ?) GROUP BY event_type`,
          )
          .all(days(sinceDays)) as { event_type: string; c: number }[],
      ),
    {},
  );
}

export interface TimeseriesPoint {
  date: string;
  value: number;
}

/** Daily counts for the last `sinceDays` days (gap-filled), optionally one type. */
export function timeseries(
  eventType: AnalyticsEventType | null,
  sinceDays: number,
): TimeseriesPoint[] {
  const n = Math.max(1, Math.floor(sinceDays));
  return safeRead(
    () => {
      const params: unknown[] = [days(n)];
      let typeClause = "";
      if (eventType) {
        typeClause = " AND event_type = ?";
        params.push(eventType);
      }
      const rows = getDb()
        .prepare(
          `SELECT date(created_at) AS d, COUNT(*) AS c FROM analytics_events
           WHERE created_at >= datetime('now', ?)${typeClause}
           GROUP BY d ORDER BY d`,
        )
        .all(...params) as { d: string; c: number }[];
      const byDate = new Map(rows.map((r) => [r.d, r.c]));
      return lastNDates(n).map((d) => ({ date: d, value: byDate.get(d) ?? 0 }));
    },
    lastNDates(n).map((d) => ({ date: d, value: 0 })),
  );
}

/** Distinct active days (YYYY-MM-DD), optionally within the last `sinceDays`. */
export function distinctActiveDays(sinceDays?: number): string[] {
  return safeRead(() => {
    if (sinceDays && sinceDays > 0) {
      return (
        getDb()
          .prepare(
            `SELECT DISTINCT date(created_at) AS d FROM analytics_events
             WHERE created_at >= datetime('now', ?) ORDER BY d`,
          )
          .all(days(sinceDays)) as { d: string }[]
      ).map((r) => r.d);
    }
    return (
      getDb()
        .prepare(`SELECT DISTINCT date(created_at) AS d FROM analytics_events ORDER BY d`)
        .all() as { d: string }[]
    ).map((r) => r.d);
  }, []);
}

/** The busiest single day's count for an event type (e.g. "5 missions in a day"). */
export function maxCountInSingleDay(eventType: AnalyticsEventType, sinceDays = 365): number {
  return safeRead(() => {
    const row = getDb()
      .prepare(
        `SELECT MAX(c) AS m FROM (
           SELECT COUNT(*) AS c FROM analytics_events
           WHERE event_type = ? AND created_at >= datetime('now', ?)
           GROUP BY date(created_at))`,
      )
      .get(eventType, days(sinceDays)) as { m: number | null } | undefined;
    return row?.m ?? 0;
  }, 0);
}

/** 24-length array of counts bucketed by hour-of-day for an event type. */
export function countByTypeAndHour(eventType: AnalyticsEventType, sinceDays = 365): number[] {
  return safeRead(
    () => {
      const rows = getDb()
        .prepare(
          `SELECT CAST(strftime('%H', created_at) AS INTEGER) AS h, COUNT(*) AS c
           FROM analytics_events WHERE event_type = ? AND created_at >= datetime('now', ?)
           GROUP BY h`,
        )
        .all(eventType, days(sinceDays)) as { h: number; c: number }[];
      const hours = new Array<number>(24).fill(0);
      for (const r of rows) if (r.h >= 0 && r.h < 24) hours[r.h] = r.c;
      return hours;
    },
    new Array<number>(24).fill(0),
  );
}

/** 24-length array of counts bucketed by hour-of-day across ALL event types. */
export function countByHourAllTypes(sinceDays = 365): number[] {
  return safeRead(
    () => {
      const rows = getDb()
        .prepare(
          `SELECT CAST(strftime('%H', created_at) AS INTEGER) AS h, COUNT(*) AS c
           FROM analytics_events WHERE created_at >= datetime('now', ?)
           GROUP BY h`,
        )
        .all(days(sinceDays)) as { h: number; c: number }[];
      const hours = new Array<number>(24).fill(0);
      for (const r of rows) if (r.h >= 0 && r.h < 24) hours[r.h] = r.c;
      return hours;
    },
    new Array<number>(24).fill(0),
  );
}

export interface DailyTypeCounts {
  date: string;
  /** count per event_type for that day */
  counts: Record<string, number>;
}

/**
 * Daily counts per event_type for the last `sinceDays` days (gap-filled).
 * Powers the per-category stacked area + the success-rate trend (mission
 * completed vs failed) without N separate queries.
 */
export function dailyCountsByType(sinceDays: number): DailyTypeCounts[] {
  const n = Math.max(1, Math.floor(sinceDays));
  return safeRead(
    () => {
      const rows = getDb()
        .prepare(
          `SELECT date(created_at) AS d, event_type AS t, COUNT(*) AS c
           FROM analytics_events WHERE created_at >= datetime('now', ?)
           GROUP BY d, t ORDER BY d`,
        )
        .all(days(n)) as { d: string; t: string; c: number }[];
      const byDate = new Map<string, Record<string, number>>();
      for (const r of rows) {
        const rec = byDate.get(r.d) ?? {};
        rec[r.t] = r.c;
        byDate.set(r.d, rec);
      }
      return lastNDates(n).map((d) => ({ date: d, counts: byDate.get(d) ?? {} }));
    },
    lastNDates(n).map((d) => ({ date: d, counts: {} })),
  );
}

export interface TopEntity {
  entityId: string;
  count: number;
}

/** Most-frequent entity_ids for an event type. */
export function topEntities(eventType: AnalyticsEventType, limit = 5): TopEntity[] {
  return safeRead(
    () =>
      (
        getDb()
          .prepare(
            `SELECT entity_id AS id, COUNT(*) AS c FROM analytics_events
             WHERE event_type = ? AND entity_id IS NOT NULL
             GROUP BY entity_id ORDER BY c DESC LIMIT ?`,
          )
          .all(eventType, Math.max(1, Math.floor(limit))) as { id: string; c: number }[]
      ).map((r) => ({ entityId: r.id, count: r.c })),
    [],
  );
}

export interface LatestEntityEvent {
  entityId: string;
  eventType: string;
  /** An ISO instant, not the raw column. See `isoFromSqliteUtc` below. */
  createdAt: string;
  metadataJson: string | null;
}

/**
 * `datetime('now')` writes "2026-09-06 01:00:00": UTC, a space, no zone marker.
 * `new Date()` reads a string in that shape as LOCAL time, so on a machine an
 * hour ahead of UTC the row lands in the future and every "how long ago" reader
 * in the app answers "never". Every row this table holds took the column
 * DEFAULT (insertEvent passes no created_at), so the shape is known.
 */
function isoFromSqliteUtc(value: string): string {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(" ", "T")}Z` : value;
}

/**
 * The most recent event of the given types, one row per entity_id.
 *
 * The Scripts page reads this to answer "did last night's backup work?" from
 * the ledger that already records it, rather than from a second store of its
 * own. Bare columns beside a lone `max()` take their values from the row that
 * produced the maximum: that is documented SQLite behaviour for min/max, and it
 * is what makes each row here the LATEST event rather than a mixture of one
 * entity's newest timestamp and its oldest payload.
 */
export function latestEventPerEntity(
  entityType: AnalyticsEntityType,
  eventTypes: readonly AnalyticsEventType[],
): LatestEntityEvent[] {
  if (eventTypes.length === 0) return [];
  return safeRead(() => {
    const placeholders = eventTypes.map(() => "?").join(", ");
    const rows = getDb()
      .prepare(
        `SELECT entity_id AS id, event_type AS type, metadata_json AS meta, MAX(created_at) AS at
         FROM analytics_events
         WHERE entity_type = ? AND entity_id IS NOT NULL AND event_type IN (${placeholders})
         GROUP BY entity_id`,
      )
      .all(entityType, ...eventTypes) as { id: string; type: string; meta: string | null; at: string }[];
    return rows.map((r) => ({
      entityId: r.id,
      eventType: r.type,
      createdAt: isoFromSqliteUtc(r.at),
      metadataJson: r.meta,
    }));
  }, []);
}

/** Distinct profiles seen (optionally for one event type) — feeds breadth achievements. */
export function distinctProfileCount(eventType?: AnalyticsEventType): number {
  return safeRead(() => {
    if (eventType) {
      const row = getDb()
        .prepare(
          `SELECT COUNT(DISTINCT profile) AS c FROM analytics_events
           WHERE event_type = ? AND profile IS NOT NULL`,
        )
        .get(eventType) as { c: number } | undefined;
      return row?.c ?? 0;
    }
    const row = getDb()
      .prepare(`SELECT COUNT(DISTINCT profile) AS c FROM analytics_events WHERE profile IS NOT NULL`)
      .get() as { c: number } | undefined;
    return row?.c ?? 0;
  }, 0);
}

/** Number of distinct event types ever recorded — feeds the "explorer" breadth ladder. */
export function distinctEventTypeCount(): number {
  return safeRead(() => {
    const row = getDb()
      .prepare(`SELECT COUNT(DISTINCT event_type) AS c FROM analytics_events`)
      .get() as { c: number } | undefined;
    return row?.c ?? 0;
  }, 0);
}

// ── Run aggregates ───────────────────────────────────────────
//
// The reads behind run-aggregates.ts. They mine `runs` (joined to
// `missions` for the model dimension) rather than analytics_events,
// which is why they carry their own section rather than hiding among
// the event queries. Each one throws on failure: run-aggregates.ts
// already wraps every call in its own `safeRead` with the fallback
// value that surface needs, and swallowing here would pre-empt it.

/** Submit/complete timestamps for completed runs in the window (`sinceExpr` is a `'-N days'` modifier). */
export function readCompletedRunTimings(
  sinceExpr: string,
): Array<{ submitted_at: string; completed_at: string }> {
  return getDb()
    .prepare(
      `SELECT submitted_at, completed_at FROM runs
         WHERE status = 'completed' AND completed_at IS NOT NULL
           AND submitted_at >= datetime('now', ?)`,
    )
    .all(sinceExpr) as { submitted_at: string; completed_at: string }[];
}

/** Per-run usage JSON with the model dimension from the linked mission. */
export function readRunUsageByModel(
  sinceExpr: string,
): Array<{ model: string | null; provider: string | null; usage: string }> {
  return getDb()
    .prepare(
      `SELECT m.model_id AS model, m.provider AS provider, r.usage_json AS usage
         FROM runs r JOIN missions m ON r.mission_id = m.id
         WHERE r.submitted_at >= datetime('now', ?) AND r.usage_json IS NOT NULL`,
    )
    .all(sinceExpr) as { model: string | null; provider: string | null; usage: string }[];
}

/** Completed-run counts per mission in the window. */
export function readCompletedRunCountsByMission(
  sinceExpr: string,
): Array<{ id: string; name: string; runs: number; usage: string | null }> {
  return getDb()
    .prepare(
      `SELECT r.mission_id AS id, m.name AS name, COUNT(*) AS runs, r.usage_json AS usage
         FROM runs r JOIN missions m ON r.mission_id = m.id
         WHERE r.status = 'completed' AND r.submitted_at >= datetime('now', ?)
         GROUP BY r.mission_id`,
    )
    .all(sinceExpr) as { id: string; name: string; runs: number; usage: string | null }[];
}

/** Per-run usage JSON keyed by mission, for the token totals GROUP BY cannot compute. */
export function readCompletedRunUsageByMission(
  sinceExpr: string,
): Array<{ id: string; usage: string }> {
  return getDb()
    .prepare(
      `SELECT mission_id AS id, usage_json AS usage FROM runs
         WHERE status = 'completed' AND submitted_at >= datetime('now', ?) AND usage_json IS NOT NULL`,
    )
    .all(sinceExpr) as { id: string; usage: string }[];
}
