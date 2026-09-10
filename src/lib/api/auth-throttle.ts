// auth-throttle — what a wrong token costs.
//
// The `ps_token` compare is constant-time, which does nothing about volume, and
// `start:network` binds 0.0.0.0 (QA finding 13: no 429 at 130 requests). The
// operator ruled for a failed-auth throttle rather than a general API limiter.
//
// THE PENALTY REFUSES TO PROCESS: answering 429 while still comparing leaves
// the guess rate unchanged. IT IS SHORT: on loopback operator and attacker are
// both "local", so an unbounded lock is a denial of service against the
// operator; the ceiling is seconds and a correct token clears the record. IN
// MEMORY: a restart costs one window, and a table would put a write on the hot
// path of the one request an attacker controls the rate of.

/** Failures allowed at full speed before a penalty applies. A typo budget. */
export const FREE_AUTH_ATTEMPTS = 5;

/** The hard ceiling on a penalty window. The operator is never locked out longer. */
export const MAX_AUTH_PENALTY_SECONDS = 15;

/** How long a quiet client's record survives before it is forgotten entirely. */
const RECORD_TTL_MS = 15 * 60_000;

interface FailureRecord {
  failures: number;
  /** When the current penalty ends. 0 when none applies. */
  penaltyUntil: number;
  lastSeen: number;
}

const records = new Map<string, FailureRecord>();

/**
 * Who is failing. The same derivation the sessions limiter uses: two answers
 * to "which client" would be two security boundaries. Loopback collapses to
 * "local", the case the bounded penalty exists to make survivable.
 */
export function authClientKey(headers: {
  get(name: string): string | null;
}): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "local";
}

function prune(now: number): void {
  // Bounded by construction; otherwise the map is an attacker-controlled allocation.
  for (const [key, rec] of records) {
    if (now - rec.lastSeen > RECORD_TTL_MS) records.delete(key);
  }
}

/** Seconds this client must wait, or 0. Called BEFORE the compare, so a penalised client gets none. */
export function authPenaltySeconds(key: string, now = Date.now()): number {
  const rec = records.get(key);
  if (!rec) return 0;
  if (now - rec.lastSeen > RECORD_TTL_MS) {
    records.delete(key);
    return 0;
  }
  if (rec.penaltyUntil <= now) return 0;
  return Math.max(1, Math.ceil((rec.penaltyUntil - now) / 1000));
}

/**
 * Record a failure and set the next penalty: doubling past the free budget,
 * capped at the ceiling, so it never passes the point where an operator would
 * rather restart the server than wait.
 */
export function recordAuthFailure(key: string, now = Date.now()): void {
  prune(now);
  const rec = records.get(key) ?? { failures: 0, penaltyUntil: 0, lastSeen: now };
  rec.failures += 1;
  rec.lastSeen = now;
  if (rec.failures > FREE_AUTH_ATTEMPTS) {
    const grown = 2 ** (rec.failures - FREE_AUTH_ATTEMPTS - 1);
    rec.penaltyUntil = now + Math.min(grown, MAX_AUTH_PENALTY_SECONDS) * 1000;
  }
  records.set(key, rec);
}

/**
 * A correct token clears the record outright: holding the token is proof you
 * are not the threat, and a residue would leave an operator one typo from a penalty.
 */
export function clearAuthFailures(key: string): void {
  records.delete(key);
}

/**
 * How many clients are remembered. Exported for one assertion: `x-forwarded-for`
 * is attacker-controlled, and that the map SHRINKS is not observable from any
 * response, so without this the pruning could be deleted unnoticed. No reset
 * seam: the proxy tests jest.resetModules() and re-import, so a clear() would be dead code.
 */
export function authThrottleRecordCount(): number {
  return records.size;
}
