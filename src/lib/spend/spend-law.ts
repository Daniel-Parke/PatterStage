// ═══════════════════════════════════════════════════════════════
// spend/spend-law.ts · what a budget means, as pure functions
//
// LLM provider spend is the only thing in PatterStage that costs money. This
// file is the whole of what the product is allowed to conclude about it. It
// touches no database and no clock it was not handed, so every rule below is
// testable in one line, which is what tier R2 is for.
//
// ── THE OPERATOR'S RULING, WHICH IS THE DESIGN ─────────────────
//
//   "We should just have a warning here, AND the ability for the user to have a
//    hard stop, but we should not force this in a way that is awkward for
//    users."
//
// Four consequences, and each one is a function or a constant below:
//
//   1. A budget figure is OPTIONAL. `limitUsd: null` is the shipped state and
//      means "no budget". `evaluateSpend` returns `unset` for it, with no
//      message at all: an install with no figure warns about nothing, no matter
//      how much has been spent. A tool that refuses to work until you have
//      filled in a budget field teaches you to resent it.
//   2. A figure that IS set WARNS. That is the default and it is the whole of
//      the default. Nothing is blocked by a figure alone.
//   3. The HARD STOP is a second, separate switch, off until the operator
//      turns it on beside his own figure. Only then does `blocksUnattended`
//      ever become true.
//   4. It governs UNATTENDED work only. Nothing here knows about attended
//      dispatch, because attended dispatch never asks: a human clicking
//      dispatch is answering for the spend himself. See spend-guard.ts.
//
// ── WHY CALENDAR PERIODS, NOT ROLLING WINDOWS ──────────────────
//
// A person who types "40 dollars a month" means the month. A rolling 30-day
// window would put him over budget on a day he had spent nothing, because of
// what he spent four weeks ago, and there is no date on which it resets. So
// `periodStart` returns the start of the calendar day, the ISO week (Monday) or
// the calendar month, in UTC, in SQLite's own datetime format.
//
// UTC, not local time, because it is what the database stores and comparing a
// local boundary against UTC rows moves the budget's edge by the offset. The
// cost is that "today" starts at UTC midnight rather than the operator's; the
// alternative is a budget whose window silently disagrees with the rows it is
// measuring, which is worse in the one place being wrong costs money.
// ═══════════════════════════════════════════════════════════════

/** The windows a budget can be expressed in. Mirrors the CHECK in migration 033. */
export const SPEND_PERIODS = ["day", "week", "month"] as const;
export type SpendPeriod = (typeof SPEND_PERIODS)[number];

/**
 * The things that spend provider tokens. Scope comes off the task row for
 * three of them; Story Weaver drives callLLM directly and was invisible to
 * this list, and therefore to the console and the hard stop, until it wrote
 * its own runs row (T-0108, D87).
 */
export const SPEND_SOURCES = ["agent", "composer", "research", "story"] as const;
export type SpendSource = (typeof SPEND_SOURCES)[number];

/** The operator's budget, as the rest of the app sees it. */
export interface SpendPolicy {
  /** USD ceiling for one period, or null when no figure has ever been set. */
  limitUsd: number | null;
  /** The window the figure covers. Meaningless while `limitUsd` is null. */
  period: SpendPeriod;
  /**
   * When true AND a figure is set, breaching it stops UNATTENDED dispatch.
   * Migration 033 refuses to store `true` without a figure beside it.
   */
  hardStop: boolean;
  /** When the figure was last changed, so the console can say so. */
  updatedAt: string;
}

/**
 * What a fresh install has. Exported so the repository, the route and the tests
 * all mean the same thing by "unset" rather than each spelling it out.
 */
export const UNSET_SPEND_POLICY: SpendPolicy = {
  limitUsd: null,
  period: "month",
  hardStop: false,
  updatedAt: "",
};

/**
 * The fraction of a set figure at which the warning starts.
 *
 * 0.8 is a judgement, not a derivation, and it is worth saying so. It is early
 * enough that a person who checks the console once a day sees it before the
 * ceiling, and late enough that it is not shouting for most of the period.
 */
export const SPEND_WARN_FRACTION = 0.8;

/**
 * unset       no figure. Silent, always.
 * ok          under the warning line.
 * approaching at or past the warning line, under the figure.
 * over        at or past the figure.
 */
// Module-private on purpose. Reachable structurally through the exported
// parent type, so a caller can still read the field; nothing imports the
// NAME, and an export nothing imports is what the widened knip gate exists
// to catch. Export it again the moment a caller genuinely needs to name it.
type SpendState = "unset" | "ok" | "approaching" | "over";

export interface SpendVerdict {
  state: SpendState;
  /** Spend as a fraction of the figure, or null when there is no figure. */
  fraction: number | null;
  /** True only when a figure is set AND has been reached. */
  breached: boolean;
  /**
   * True only when `breached` AND the operator armed the stop. Attended
   * dispatch never reads this; see the header.
   */
  blocksUnattended: boolean;
  /** A sentence for a person, or null when there is nothing to say. */
  message: string | null;
}

/** USD, formatted the one way, so every surface agrees. */
export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** Human label for a period, used in both UI and refusal messages. */
export function periodLabel(period: SpendPeriod): string {
  switch (period) {
    case "day":
      return "Today";
    case "week":
      return "This week";
    default:
      return "This month";
  }
}

/** The same period as a noun that reads inside a sentence. */
export function periodNoun(period: SpendPeriod): string {
  switch (period) {
    case "day":
      return "day";
    case "week":
      return "week";
    default:
      return "month";
  }
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * The instant the given calendar period began, in UTC, in SQLite's own
 * `YYYY-MM-DD HH:MM:SS` format so it can be compared against `datetime(col)`
 * directly.
 *
 * The week starts on MONDAY. `getUTCDay()` returns 0 for Sunday, which would
 * make a naive subtraction jump back six days on a Sunday instead of forward to
 * the Monday just gone; `(day + 6) % 7` is the correction.
 */
export function periodStart(period: SpendPeriod, nowIso: string): string {
  const d = new Date(nowIso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();

  if (period === "month") return `${y}-${pad(m + 1)}-01 00:00:00`;

  if (period === "week") {
    const back = (d.getUTCDay() + 6) % 7;
    const monday = new Date(Date.UTC(y, m, day - back));
    return `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())} 00:00:00`;
  }

  return `${y}-${pad(m + 1)}-${pad(day)} 00:00:00`;
}

/**
 * The whole of the budget decision.
 *
 * Read the first branch as the feature's posture: no figure means no opinion,
 * and that is checked before anything else so a hard stop that somehow reached
 * this function without a figure beside it still cannot block. Migration 033
 * refuses to store that pair; this refuses to act on it. Both, because the one
 * thing worse than a budget that does not stop work is a stop nobody can lift.
 */
export function evaluateSpend(policy: SpendPolicy, spentUsd: number): SpendVerdict {
  const limit = policy.limitUsd;
  if (limit === null || !(limit > 0)) {
    return { state: "unset", fraction: null, breached: false, blocksUnattended: false, message: null };
  }

  const spent = Math.max(0, spentUsd);
  const fraction = spent / limit;
  const noun = periodNoun(policy.period);
  const of = `${formatUsd(spent)} of the ${formatUsd(limit)} you set for this ${noun}`;

  if (fraction >= 1) {
    return {
      state: "over",
      fraction,
      breached: true,
      blocksUnattended: policy.hardStop,
      message: policy.hardStop
        ? `Hard stop: ${of} is spent, so unattended dispatch is paused until the ${noun} rolls over or you raise the figure. Dispatching by hand still works.`
        : `${of} is spent. Nothing has been stopped: your hard stop is off.`,
    };
  }

  if (fraction >= SPEND_WARN_FRACTION) {
    return {
      state: "approaching",
      fraction,
      breached: false,
      blocksUnattended: false,
      message: `${of} is spent.`,
    };
  }

  return { state: "ok", fraction, breached: false, blocksUnattended: false, message: null };
}

/** Narrow an untrusted string to a period, or null. */
export function asSpendPeriod(value: unknown): SpendPeriod | null {
  return typeof value === "string" && (SPEND_PERIODS as readonly string[]).includes(value)
    ? (value as SpendPeriod)
    : null;
}
