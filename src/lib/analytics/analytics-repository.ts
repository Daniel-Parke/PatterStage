// ═══════════════════════════════════════════════════════════════
// analytics/analytics-repository.ts — read/write for analytics_events
//
// insertEvent is the only write (called via recordEvent). Everything else is a
// read aggregation for the Insights page + the derived achievements. Every read
// is defensive (try/catch → empty/zero) so a fresh or pre-v12 DB yields zeros,
// not errors — same discipline as stats-repository.ts.
// ═══════════════════════════════════════════════════════════════

import { db, inTransaction, uuid } from "../db";
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
    db()
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
        db()
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
        db()
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
      const rows = db()
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
        db()
          .prepare(
            `SELECT DISTINCT date(created_at) AS d FROM analytics_events
             WHERE created_at >= datetime('now', ?) ORDER BY d`,
          )
          .all(days(sinceDays)) as { d: string }[]
      ).map((r) => r.d);
    }
    return (
      db()
        .prepare(`SELECT DISTINCT date(created_at) AS d FROM analytics_events ORDER BY d`)
        .all() as { d: string }[]
    ).map((r) => r.d);
  }, []);
}

/** The busiest single day's count for an event type (e.g. "5 missions in a day"). */
export function maxCountInSingleDay(eventType: AnalyticsEventType, sinceDays = 365): number {
  return safeRead(() => {
    const row = db()
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
      const rows = db()
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

export interface TopEntity {
  entityId: string;
  count: number;
}

/** Most-frequent entity_ids for an event type. */
export function topEntities(eventType: AnalyticsEventType, limit = 5): TopEntity[] {
  return safeRead(
    () =>
      (
        db()
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

/** Distinct profiles seen (optionally for one event type) — feeds breadth achievements. */
export function distinctProfileCount(eventType?: AnalyticsEventType): number {
  return safeRead(() => {
    if (eventType) {
      const row = db()
        .prepare(
          `SELECT COUNT(DISTINCT profile) AS c FROM analytics_events
           WHERE event_type = ? AND profile IS NOT NULL`,
        )
        .get(eventType) as { c: number } | undefined;
      return row?.c ?? 0;
    }
    const row = db()
      .prepare(`SELECT COUNT(DISTINCT profile) AS c FROM analytics_events WHERE profile IS NOT NULL`)
      .get() as { c: number } | undefined;
    return row?.c ?? 0;
  }, 0);
}

/** Number of distinct event types ever recorded — feeds the "explorer" breadth ladder. */
export function distinctEventTypeCount(): number {
  return safeRead(() => {
    const row = db()
      .prepare(`SELECT COUNT(DISTINCT event_type) AS c FROM analytics_events`)
      .get() as { c: number } | undefined;
    return row?.c ?? 0;
  }, 0);
}
