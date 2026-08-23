// ═══════════════════════════════════════════════════════════════
// spend/spend-repository.ts · every statement the spend feature runs
//
// The only file in src/lib/spend/ that contains SQL (WG-ARCH-002). Nothing
// above it knows a column name, and nothing below it decides anything.
//
// ── THREE THINGS TO KNOW BEFORE EDITING ANYTHING HERE ──────────
//
// 1. NO NEW TRACKING. Every figure this feature reports is mined from rows that
//    were already being written before it existed: `runs.usage_json`, which the
//    reconcile path stamps from the runtime's own token counts, and the model
//    dimension on the linked mission. The task row was explicit that spend is
//    computed from what is already recorded, and the only honest way to hold
//    that line is for this file to add no writes except the policy itself.
//
// 2. `runs.submitted_at` CARRIES TWO DIFFERENT TIMESTAMP SHAPES. The scheduler
//    claims an occurrence through `createRun`, which passes `now()` =
//    `new Date().toISOString()` ("2026-08-23T10:00:00.000Z"). Rows inserted
//    without that argument take the column DEFAULT `datetime('now')`
//    ("2026-08-23 10:00:00"). Those do NOT compare correctly as strings: 'T' is
//    0x54 and ' ' is 0x20, so an ISO row sorts after every SQLite-shaped row on
//    the same day and a naive `>=` silently drops or admits whole days. Every
//    comparison here therefore goes through SQLite's `datetime()`, exactly as
//    retention-repository.ts does and for exactly the same reason. It costs the
//    index; a budget read that runs once per tick can afford a scan, and a
//    budget boundary that is right only on most days cannot.
//
// 3. THE JOIN TO `missions` IS A LEFT JOIN, DELIBERATELY. A Composer stage run
//    has a `composer_node_run_id` and NO `mission_id`. The Insights per-model
//    aggregate (analytics/run-aggregates.ts) INNER JOINs missions, which is why
//    Composer spend has never appeared in it at all. An inner join here would
//    reproduce that hole in the one place it would be a money error rather than
//    a chart error, so Composer stages come through with a null model and are
//    priced at model-cost's conservative default. Unknown must never read as
//    free.
// ═══════════════════════════════════════════════════════════════

import { getDb, inTransaction } from "@/lib/db";
import {
  UNSET_SPEND_POLICY,
  asSpendPeriod,
  type SpendPeriod,
  type SpendPolicy,
} from "./spend-law";

/** One priced-run row: which source it belongs to, its model, its raw usage JSON. */
export interface SpendUsageRow {
  source: "agent" | "composer";
  model: string | null;
  usage: string;
}

/**
 * Every run in the window that recorded token usage, tagged by source.
 *
 * `sinceExpr` is a SQLite-format instant from `periodStart`. Runs of EVERY
 * status are included, not just completed ones: a run that failed after burning
 * tokens still cost money, and a budget that only counted successes would
 * under-report precisely when things were going wrong.
 *
 * Throws on failure. The callers wrap this themselves with the fallback each
 * one needs, and those fallbacks are not the same: the summary degrades to
 * zero, the guard refuses. Swallowing here would take that choice away from
 * the one caller whose choice costs money.
 */
export function readRunUsageSince(sinceExpr: string): SpendUsageRow[] {
  return getDb()
    .prepare(
      `SELECT
         CASE WHEN r.composer_node_run_id IS NOT NULL THEN 'composer' ELSE 'agent' END AS source,
         m.model_id AS model,
         r.usage_json AS usage
       FROM runs r
       LEFT JOIN missions m ON r.mission_id = m.id
       WHERE r.usage_json IS NOT NULL
         AND datetime(r.submitted_at) >= ?`,
    )
    .all(sinceExpr) as SpendUsageRow[];
}

/**
 * How many Deep Research runs started in the window.
 *
 * A COUNT and nothing else, because there is nothing else to read. Deep
 * Research drives `callLLM` directly and discards the usage it returns:
 * `research_runs` has no token or cost column, and `research_steps` stores
 * prompt and output text but no counts. So its spend is genuinely NOT
 * recoverable from this database, and the count is here so the console can say
 * "three runs, cost not recorded" instead of showing a confident $0.00.
 */
export function countResearchRunsSince(sinceExpr: string): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM research_runs WHERE datetime(created_at) >= ?`)
    .get(sinceExpr) as { c: number } | undefined;
  return row?.c ?? 0;
}

interface RawSpendPolicy {
  limit_usd: number | null;
  period: string;
  hard_stop: number;
  updated_at: string;
}

/**
 * The operator's budget row (migration 033 seeds exactly one).
 *
 * A database with no row yet reads as UNSET rather than as an error, so the
 * feature is inert on an install mid-migration instead of breaking it.
 */
export function readSpendPolicy(): SpendPolicy {
  const row = getDb()
    .prepare(`SELECT limit_usd, period, hard_stop, updated_at FROM spend_policy WHERE id = 1`)
    .get() as RawSpendPolicy | undefined;
  if (!row) return { ...UNSET_SPEND_POLICY };

  return {
    limitUsd: row.limit_usd,
    period: asSpendPeriod(row.period) ?? "month",
    hardStop: row.hard_stop === 1,
    updatedAt: row.updated_at,
  };
}

export interface SpendPolicyPatch {
  limitUsd?: number | null;
  period?: SpendPeriod;
  hardStop?: boolean;
}

/**
 * Change the budget. Every supplied field is written in ONE statement.
 *
 * That is not tidiness. Migration 033 refuses to hold `hard_stop = 1` with no
 * figure beside it, so clearing the figure and disarming the stop as two
 * statements would fail on the first of them. Writing them together means the
 * pair the database forbids never exists, not even inside a transaction.
 *
 * A patch with nothing in it is a no-op rather than an error, so a caller that
 * filtered everything out does not have to check first.
 */
export function writeSpendPolicy(patch: SpendPolicyPatch): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (patch.limitUsd !== undefined) {
    sets.push("limit_usd = ?");
    params.push(patch.limitUsd);
  }
  if (patch.period !== undefined) {
    sets.push("period = ?");
    params.push(patch.period);
  }
  if (patch.hardStop !== undefined) {
    sets.push("hard_stop = ?");
    params.push(patch.hardStop ? 1 : 0);
  }
  if (sets.length === 0) return;

  inTransaction(() => {
    getDb()
      .prepare(
        `UPDATE spend_policy SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = 1`,
      )
      .run(...params);
  });
}
