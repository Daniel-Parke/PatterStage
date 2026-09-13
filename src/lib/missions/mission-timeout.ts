// ═══════════════════════════════════════════════════════════════
// mission-timeout.ts: the one ruling on how long a mission may run
//
// Round 6, finding 12, sharper than reported (T-0088). timeoutMinutes was a
// bare cast at the body boundary. The reconciler's unreachable-backend cap
// is `declared ?? DEFAULT_MAX_RUN_MINUTES`, so 1e9 did not exceed the safety
// cap, it REPLACED it: a mission whose backend vanished never self-healed and
// held the single-flight gate forever. A string "60" put a limit in the
// prompt the reconciler did not enforce. A positive integer inside a ceiling
// is the only shape either side can trust.
// ═══════════════════════════════════════════════════════════════

export const MIN_TIMEOUT_MINUTES = 1;
/** Three days. Long enough for any mission this product schedules. */
export const MAX_TIMEOUT_MINUTES = 4320;

/**
 * A timeout from an untrusted value: the integer, `undefined` when absent,
 * or "invalid" when something was supplied that is not a positive integer
 * inside the ceiling. Callers at the HTTP boundary turn "invalid" into a 400;
 * the shared body parser turns it into `undefined` so nothing wrong is stored.
 */
export function parseTimeoutMinutes(value: unknown): number | undefined | "invalid" {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value)) return "invalid";
  if (value < MIN_TIMEOUT_MINUTES || value > MAX_TIMEOUT_MINUTES) return "invalid";
  return value;
}

/** The 400 text for a body carrying a bad timeout, or null when both are fine. */
export function missionTimeoutError(body: Record<string, unknown>): string | null {
  for (const field of ["timeoutMinutes", "missionTimeMinutes"] as const) {
    if (parseTimeoutMinutes(body[field]) === "invalid") {
      return (
        `${field} must be a whole number of minutes from ${MIN_TIMEOUT_MINUTES} to ` +
        `${MAX_TIMEOUT_MINUTES} (got ${JSON.stringify(body[field])})`
      );
    }
  }
  return null;
}
