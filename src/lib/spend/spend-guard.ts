// spend/spend-guard.ts · the only thing here that can prevent work.
//
// One function, three callers, all on the BackgroundScheduler (schedule tick,
// queued-mission drain, Composer tick). Nothing a human clicks reaches it, and
// tests/unit/spend-unattended-dispatch holds that as source-level fact.
//
// THE DEFAULT IS YES. The operator's ruling was about not being awkward, so
// the refusal is as narrow as can be: no figure, or stop off (clause 3, a
// figure warns), or under the figure, all allowed; at or over with the stop on
// is REFUSED with a sentence.
//
// WHEN THE DATABASE WILL NOT ANSWER the two directions are not symmetric. A
// failed POLICY read is no evidence a stop was armed, and refusing would break
// unattended dispatch on every install with no budget: allowed. A failed SPEND
// read while a stop IS armed means proceeding spends real money on an
// assumption it cannot support, while declining costs one hand-dispatched run:
// refused, and the reason says which failure it was. That asymmetry is why
// this file does not share the summary's blanket safeRead.

import { logApiError } from "@/lib/api-logger";
import { evaluateSpend, periodNoun, periodStart } from "./spend-law";
import { readSpendPolicy } from "./spend-repository";
import { recordedSpendSince } from "./spend-window";

export interface UnattendedSpendVerdict {
  allowed: boolean;
  /** Why not, in a sentence, or null when allowed. */
  reason: string | null;
}

const ALLOWED: UnattendedSpendVerdict = { allowed: true, reason: null };

/** May unattended work dispatch now? Cheap on the common path: an install with
 *  no armed stop returns after ONE indexed read, and this runs every scheduler tick. */
export function checkUnattendedSpend(): UnattendedSpendVerdict {
  let policy;
  try {
    policy = readSpendPolicy();
  } catch (err) {
    // No evidence a stop exists: fails open (header).
    logApiError("spend.checkUnattendedSpend", "policy", err);
    return ALLOWED;
  }

  // Clause 2 and 3, and the early return that keeps this free for everyone who never asked.
  if (policy.limitUsd === null || !policy.hardStop) return ALLOWED;

  const since = periodStart(policy.period, new Date().toISOString());
  let spent: number;
  try {
    spent = recordedSpendSince(since).totalUsd;
  } catch (err) {
    // A stop IS armed and we cannot show we are under it: fails closed, naming the failure (header).
    logApiError("spend.checkUnattendedSpend", "spend", err);
    return {
      allowed: false,
      reason:
        "Hard spend stop is on, but this period's spend could not be measured, " +
        "so unattended dispatch is paused. Dispatching by hand still works.",
    };
  }

  const verdict = evaluateSpend(policy, spent);
  if (!verdict.blocksUnattended) return ALLOWED;

  return {
    allowed: false,
    reason:
      `Hard spend stop: $${spent.toFixed(2)} of the $${policy.limitUsd.toFixed(2)} ` +
      `budget for this ${periodNoun(policy.period)} is already spent. Unattended ` +
      `dispatch is paused. Dispatching by hand still works.`,
  };
}
