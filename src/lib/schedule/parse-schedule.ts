/**
 * Hermes-compatible schedule parsing for PatterStage.
 * Supports interval, cron, and ISO one-shot formats used with Hermes `jobs.json`.
 */

import type { ParsedSchedule } from "./types";

/** Check if a string looks like a cron expression (5+ space-separated cron fields). */
export function looksLikeCronExpression(s: string): boolean {
  if (!s || typeof s !== "string") return false;
  const parts = s.trim().split(/\s+/);
  return parts.length >= 5 && parts.every((p) => /^[*\-,\/0-9]+$/.test(p));
}

/**
 * Convert an interval shorthand (e.g. "every 30m", "every 2h", "every 1d")
 * to a 5-field cron expression. Returns null when the input isn't a
 * representable interval — fall through to using the raw cron in that case.
 *
 * Edge cases:
 *  - "every 60m" → "0 * * * *"          (1 hour)
 *  - "every 90m" → "star-slash-30 * * * *" (rounded to nearest divisor of 60)
 *  - "every 1d"  → "0 0 * * *"          (midnight)
 *  - "every 2d"  → "0 0 star-slash-2 * *"
 *  - "every 24h" → "0 * * * *"          (every hour)
 *  - "every 25h" → "0 star-slash-1 * * *" (every hour, since cron has no
 *                                          "every N hours" larger than 23).
 *
 * Non-integer multiples are best-effort — we round to the nearest divisor
 * rather than rejecting, so the existing user-visible "every Nm" preset
 * keeps firing at roughly the same cadence. (Hermes' own `parse_schedule`
 * silently accepts any `parse_duration` result, so there's no source of
 * truth to perfectly match — see cron/jobs.py:parse_duration.)
 */
export function intervalShorthandToCron(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  const match = input.trim().match(/^every\s+(\d+)\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|day|days)$/i);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(n) || n <= 0) return null;
  if (unit.startsWith("h")) {
    if (n >= 24) return "0 * * * *"; // every hour — beyond cron expr's reach
    return `0 */${n} * * *`;
  }
  if (unit.startsWith("d")) {
    if (n === 1) return "0 0 * * *";
    return `0 0 */${n} * *`;
  }
  // minutes
  if (n >= 60) return "0 * * * *"; // round up to hourly
  // find a divisor of 60 close to n; use n directly if it divides 60,
  // otherwise round to the nearest divisor (capped at 30 to avoid long gaps).
  if (60 % n === 0) return `*/${n} * * * *`;
  const divisors = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30];
  let best = divisors[0];
  let bestDelta = Math.abs(n - best);
  for (const d of divisors) {
    const delta = Math.abs(n - d);
    if (delta < bestDelta) { best = d; bestDelta = delta; }
  }
  return `*/${best} * * * *`;
}

/**
 * Parse a schedule string for Hermes `jobs.json`.
 */
export function parseSchedule(raw: string): ParsedSchedule {
  const s = (typeof raw === "string" ? raw : "").trim();

  if (!s) {
    return { kind: "invalid", raw: "", message: "Schedule is empty" };
  }

  const simpleIntervalMatch = s.match(/^(?:every\s+)?(\d+)\s*(m|min|minutes?|h|hr|hours?|d|day|days?)$/i);
  if (simpleIntervalMatch) {
    const n = parseInt(simpleIntervalMatch[1], 10);
    const unit = simpleIntervalMatch[2].toLowerCase();
    let minutes: number;
    if (unit.startsWith("h")) {
      minutes = n * 60;
    } else if (unit.startsWith("d")) {
      minutes = n * 1440;
    } else {
      minutes = n;
    }
    return { kind: "interval", minutes, display: `every ${minutes}m` };
  }

  if (looksLikeCronExpression(s)) {
    return { kind: "cron", expr: s, display: s };
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return { kind: "once", run_at: s, display: s };
  }

  return {
    kind: "invalid",
    raw: s,
    message: `Unrecognized schedule: ${s.slice(0, 120)}`,
  };
}

/**
 * Extract the human-readable `display` field from a `ParsedSchedule`,
 * falling back to `fallback` for the `invalid` variant (which has no
 * `display` field).
 *
 * The 3 call sites that used to inline this type-narrowing pattern
 * (`"display" in parsed ? (parsed as { display: string }).display : <fallback>`)
 * now use this helper. The `in` operator is the canonical way to narrow
 * the `ParsedSchedule` discriminated union on the `display` field —
 * TypeScript can't narrow it via `parsed.kind` because 3 of the 4
 * variants have a `display` field and the 4th (`invalid`) doesn't.
 *
 * Byte-equivalence: the inline form and the helper form produce the
 * same string for every reachable input (the `invalid` variant is
 * the only one that takes the fallback branch, and the `display`
 * field is non-empty on the 3 success variants per `parseSchedule`).
 *
 * @param parsed — the result of `parseSchedule()`.
 * @param fallback — the string returned when `parsed.kind === "invalid"`.
 *                   Callers pass their own "raw input" form (raw, trimmed,
 *                   or canonicalised) so the fallback matches the
 *                   surrounding context.
 *
 * @see parseSchedule
 * @see ParsedSchedule
 */
export function scheduleDisplayFromParsed(
  parsed: ParsedSchedule,
  fallback: string,
): string {
  return "display" in parsed ? (parsed.display as string) : fallback;
}
