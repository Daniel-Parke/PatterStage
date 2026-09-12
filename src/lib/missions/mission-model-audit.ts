// ═══════════════════════════════════════════════════════════════
// mission-model-audit.ts — discover and fixup mission rows whose
// `model_id` is no longer in the PatterStage models registry.
//
// Background: prior to the registry-enforcement fix (2026-06-09), a
// mission could be dispatched with any caller-supplied `modelId`,
// even one not present in the `models` table. The "registry is the
// single source of truth" policy means historical mission rows with
// foreign `model_id` values are now considered stale data and
// flagged for cleanup. This module gives the codebase a way to:
//
//   1. `auditForeignMissionModelRows()` — list them (read-only).
//   2. `fixupForeignMissionModelRows()` — null out model_id/provider
//      on the affected rows, so any future re-dispatch falls through
//      to the agent default rather than re-using the foreign value.
// ═══════════════════════════════════════════════════════════════

import {
  clearForeignMissionModelRows,
  readForeignMissionModelRows,
} from "./mission-repository";

export interface ForeignMissionModelRow {
  id: string;
  name: string;
  modelId: string;
  provider: string | null;
  status: string;
  updatedAt: string;
}

/**
 * Return every mission row whose `model_id` is non-null and not
 * present in the `models` table. Sorted by `updated_at` descending
 * (most-recently-touched first) so a human reviewer sees the
 * highest-relevance orphans at the top.
 */
export function auditForeignMissionModelRows(): ForeignMissionModelRow[] {
  return readForeignMissionModelRows();
}

/**
 * Null out `model_id` and `provider` on every mission row whose
 * `model_id` is not in the registry. Returns the number of rows
 * affected. Use after a registry cleanup or before a deploy to
 * ensure no mission will re-dispatch a foreign value.
 */
export function fixupForeignMissionModelRows(): number {
  // The statement uses a non-correlated `NOT IN` form, and the reason
  // travels with it in mission-repository.ts: an UPDATE with a
  // correlated subquery in the WHERE clause silently matches zero rows
  // in SQLite, even when the audit form of the same query finds them.
  return clearForeignMissionModelRows();
}
