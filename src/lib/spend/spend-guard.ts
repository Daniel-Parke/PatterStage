// ═══════════════════════════════════════════════════════════════
// spend/spend-guard.ts · the only thing here that can prevent work
//
// One function. Three callers, all of them on the BackgroundScheduler:
// the schedule tick, the queued-mission drain, and the Composer tick. Nothing
// a human clicks reaches this file, and tests/unit/spend-unattended-dispatch
// holds that as source-level fact: the attended modules must not import it.
//
// ── THE DEFAULT IS YES ─────────────────────────────────────────
//
// The operator's ruling was about not being awkward, and the awkward version of
// this feature is the one that finds reasons to refuse. So the refusal is as
// narrow as it can be made:
//
//   no figure                     -> allowed. The overwhelming majority of
//                                    installs, forever, and they never even pay
//                                    for the spend aggregation.
//   figure, stop off              -> allowed. That is clause 3: a figure warns.
//   figure, stop on, under        -> allowed.
//   figure, stop on, at or over   -> REFUSED, with a sentence saying so.
//
// ── WHEN THE DATABASE WILL NOT ANSWER ──────────────────────────
//
// The two failure directions are not symmetric, and treating them as if they
// were is how this feature would end up either useless or dangerous.
//
//   The POLICY read fails. There is no evidence a stop was ever armed, and the
//   install that has one is rare. Refusing here would break unattended dispatch
//   on every install with no budget, which is precisely the outcome the ruling
//   forbids. So: allowed.
//
//   The SPEND read fails while a stop IS armed. Here the operator has said, in
//   as many words, do not spend past this number, and the system cannot show it
//   is under the number. Proceeding spends real money on an assumption it
//   cannot support. Declining costs a delayed run that a human can dispatch by
//   hand in one click. So: refused, and the reason says why rather than
//   pretending a figure was breached.
//
// That asymmetry is the whole reason this file does not share the summary's
// blanket safeRead. A read-model may degrade to zeros. A money gate may not.
// ═══════════════════════════════════════════════════════════════

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

/** Recorded spend inside a window. Throws; the caller decides what that means. */

/**
 * May unattended work dispatch right now?
 *
 * Cheap on the common path: an install with no armed stop returns after ONE
 * indexed single-row read and never aggregates anything, which matters because
 * this runs on every scheduler tick.
 */
export function checkUnattendedSpend(): UnattendedSpendVerdict {
  let policy;
  try {
    policy = readSpendPolicy();
  } catch (err) {
    // No evidence a stop exists. See the header: this direction fails open.
    logApiError("spend.checkUnattendedSpend", "policy", err);
    return ALLOWED;
  }

  // Clause 2 and clause 3, and the early return that keeps this feature free
  // for everyone who never asked for it.
  if (policy.limitUsd === null || !policy.hardStop) return ALLOWED;

  const since = periodStart(policy.period, new Date().toISOString());
  let spent: number;
  try {
    spent = recordedSpendSince(since).totalUsd;
  } catch (err) {
    // A stop IS armed and we cannot show we are under it. See the header: this
    // direction fails closed, and says which failure it is.
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
