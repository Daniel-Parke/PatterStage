// spend/spend-law.ts · what a budget means, as pure functions. LLM provider
// spend is the only thing in PatterStage that costs money; this is the whole of
// what the product may conclude about it, with no database and no clock it was
// not handed, so every rule is testable in one line (tier R2).
//
// The operator's ruling, which is the design: "We should just have a warning
// here, AND the ability for the user to have a hard stop, but we should not
// force this in a way that is awkward for users." So:
//   1. A figure is OPTIONAL. `limitUsd: null` ships and means "no budget";
//      `evaluateSpend` returns `unset` for it and says nothing at all.
//   2. A figure that is set WARNS, and that is the whole of the default.
//   3. The HARD STOP is a second switch, off until the operator arms it beside
//      his own figure; only then is `blocksUnattended` ever true.
//   4. It governs UNATTENDED work only. A human clicking dispatch answers for
//      the spend himself (spend-guard.ts).
//
// Calendar periods, not rolling windows: "40 dollars a month" means the month,
// and a rolling window never resets. `periodStart` is UTC because that is what
// the database stores; a local boundary compared against UTC rows moves the
// budget's edge by the offset, which is worse than "today" starting at UTC midnight.

/** The windows a budget can be expressed in. Mirrors the CHECK in migration 033. */
export const SPEND_PERIODS = ["day", "week", "month"] as const;
export type SpendPeriod = (typeof SPEND_PERIODS)[number];

/**
 * The things that spend provider tokens. Story Weaver drives callLLM directly
 * and was invisible here, and so to the console and the hard stop, until it
 * wrote its own runs row (T-0108, D87).
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

/** A fresh install's policy, exported so the repository, route and tests mean one thing by "unset". */
export const UNSET_SPEND_POLICY: SpendPolicy = {
  limitUsd: null,
  period: "month",
  hardStop: false,
  updatedAt: "",
};

/**
 * Where the warning starts. 0.8 is a judgement, not a derivation: early enough
 * that a once-a-day check sees it before the ceiling, late enough not to shout
 * for most of the period.
 */
export const SPEND_WARN_FRACTION = 0.8;

/** unset: no figure, silent. ok: under the warning line. approaching: past it, under the figure. over: at or past it. */
// Module-private on purpose: reachable structurally through the exported parent
// type, and an export nothing imports is what the widened knip gate exists to catch.
type SpendState = "unset" | "ok" | "approaching" | "over";

export interface SpendVerdict {
  state: SpendState;
  /** Spend as a fraction of the figure, or null when there is no figure. */
  fraction: number | null;
  /** True only when a figure is set AND has been reached. */
  breached: boolean;
  /** True only when `breached` AND the operator armed the stop. Attended dispatch never reads this. */
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

/**
 * The period as a possessive, so every money sentence names its own window: the
 * console draws three tiles, and one unattributed "this period's total" beneath
 * them could not say which it meant.
 */
export function periodPossessive(period: SpendPeriod): string {
  switch (period) {
    case "day":
      return "today's";
    case "week":
      return "this week's";
    default:
      return "this month's";
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
 * The instant the calendar period began, in UTC, in SQLite's `YYYY-MM-DD
 * HH:MM:SS` so it compares against `datetime(col)` directly. The week starts on
 * MONDAY: `getUTCDay()` is 0 on Sunday, and `(day + 6) % 7` is the correction.
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
 * The whole of the budget decision. No figure means no opinion, checked first,
 * so a hard stop that reached here without a figure still cannot block.
 * Migration 033 refuses to store that pair; this refuses to act on it, because
 * a stop nobody can lift is worse than a budget that does not stop work.
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
