// ═══════════════════════════════════════════════════════════════
// spend/spend-repository.ts · every statement the spend feature runs
//
// The only file in src/lib/spend/ that contains SQL (WG-ARCH-002): nothing
// above it knows a column name, and nothing below it decides anything.
//
// 1. NO NEW TRACKING. Every figure is mined from rows already written before
//    the feature existed (`runs.usage_json`, stamped by reconcile from the
//    runtime's own counts, and the model on the linked mission), so this file
//    adds no writes except the policy itself.
// 2. `runs.submitted_at` CARRIES TWO TIMESTAMP SHAPES: `createRun` passes an
//    ISO string ("2026-08-23T10:00:00.000Z"); rows without it take the column
//    DEFAULT `datetime('now')` ("2026-08-23 10:00:00"). 'T' sorts after ' ', so
//    a string `>=` silently drops or admits whole days; every comparison goes
//    through `datetime()`, as retention-repository.ts does, at the cost of the
//    index, which a once-per-tick read can afford.
// 3. THE JOIN TO `missions` IS A LEFT JOIN. A Composer stage run has no
//    `mission_id`; the Insights aggregate (analytics/run-aggregates.ts) INNER
//    JOINs and has never shown Composer spend. Here that hole would be a money
//    error, so Composer stages arrive with a null model and are priced at
//    model-cost's conservative default. Unknown must never read as free.
// ═══════════════════════════════════════════════════════════════

import { getDb, inTransaction } from "@/lib/db";
import {
  UNSET_SPEND_POLICY,
  asSpendPeriod,
  type SpendPeriod,
  type SpendPolicy,
  type SpendSource,
} from "./spend-law";

/** One priced-run row: which source it belongs to, its model, its raw usage JSON. */
export interface SpendUsageRow {
  source: SpendSource;
  model: string | null;
  usage: string;
}

/**
 * How a `runs` row is classified into a spend source. Shared by both reads so
 * the per-story figure the Rec Room shows cannot disagree with the console's
 * Story Weaver row: same expression, same fold.
 */
const SOURCE_CASE = `CASE
    WHEN r.spend_source IS NOT NULL AND r.spend_source <> 'agent' THEN r.spend_source
    WHEN r.composer_node_run_id IS NOT NULL THEN 'composer'
    ELSE 'agent'
  END`;

/**
 * Every run in the window that recorded token usage, tagged by source.
 * `sinceExpr` is a SQLite-format instant from `periodStart`. Runs of EVERY
 * status count: a run that failed after burning tokens still cost money.
 *
 * Throws on failure. The callers' fallbacks differ (the summary degrades to
 * zero, the guard refuses), and swallowing here would take that choice away.
 */
export function readRunUsageSince(sinceExpr: string): SpendUsageRow[] {
  return getDb()
    .prepare(
      `SELECT
         ${SOURCE_CASE} AS source,
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
 * Every recorded run linked to ONE story, in the window read's shape. No date
 * bound: a story is not a calendar period. The model is NULL for the same
 * reason it is null there: a story run has no mission to join, and resolving
 * the story's model at this one site would give the reader a different number
 * from the console for the same money, the drift T-0108 (D104) removed.
 * Throws on failure, like the read above, so the caller keeps its own fallback.
 */
export function readRunUsageForStory(storyId: string): SpendUsageRow[] {
  return getDb()
    .prepare(
      `SELECT
         ${SOURCE_CASE} AS source,
         NULL AS model,
         r.usage_json AS usage
       FROM runs r
       WHERE r.story_id = ?
         AND r.usage_json IS NOT NULL`,
    )
    .all(storyId) as SpendUsageRow[];
}

/** One Deep Research run's recorded usage. NULL columns mean "never recorded". */
export interface ResearchUsageRow {
  promptTokens: number | null;
  completionTokens: number | null;
  model: string | null;
}

/**
 * What each Deep Research run in the window cost, in tokens. Rows with NULL
 * columns are returned, not filtered: the caller must tell a run that cost
 * nothing from one whose cost was never recorded, or pre-034 research quietly
 * reads as free again. Throws on failure, like `readRunUsageSince`.
 */
export function readResearchUsageSince(sinceExpr: string): ResearchUsageRow[] {
  return getDb()
    .prepare(
      `SELECT prompt_tokens AS promptTokens,
              completion_tokens AS completionTokens,
              model_id AS model
         FROM research_runs
        WHERE datetime(created_at) >= ?`,
    )
    .all(sinceExpr) as ResearchUsageRow[];
}

interface RawSpendPolicy {
  limit_usd: number | null;
  period: string;
  hard_stop: number;
  updated_at: string;
}

/**
 * The operator's budget row (migration 033 seeds exactly one). No row reads as
 * UNSET rather than as an error, so the feature is inert mid-migration.
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
 * Change the budget, every supplied field in ONE statement: migration 033
 * refuses `hard_stop = 1` with no figure beside it, so clearing the figure and
 * disarming the stop as two statements would fail on the first. An empty patch
 * is a no-op rather than an error, so a caller need not check first.
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
