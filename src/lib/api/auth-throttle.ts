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
// The clock is monotonic so a wall-clock correction cannot extend a lockout.

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
type SharedFailureRecord = FailureRecord & { firstClaimedClient: string; rotatedClaim: boolean };
let sharedFailures: SharedFailureRecord | null = null;

/**
 * Who is failing. One derivation, which the sessions limiter imports rather
 * than copies: two answers to "which client" would be two security boundaries.
 *
 * This header is a claimed identity, not a trusted peer address. The shared
 * failure budget below stops a caller from resetting the token budget by
 * rotating it. A single failing client retains its local budget.
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
  if (sharedFailures && now - sharedFailures.lastSeen > RECORD_TTL_MS) sharedFailures = null;
}

/** Seconds this client must wait, or 0. Called BEFORE the compare, so a penalised client gets none. */
export function authPenaltySeconds(key: string, now = performance.now()): number {
  const rec = records.get(key);
  if (rec && now - rec.lastSeen > RECORD_TTL_MS) {
    records.delete(key);
  }
  if (sharedFailures && now - sharedFailures.lastSeen > RECORD_TTL_MS) sharedFailures = null;
  const localUntil = rec && now - rec.lastSeen <= RECORD_TTL_MS ? rec.penaltyUntil : 0;
  const sharedUntil = sharedFailures?.rotatedClaim ? sharedFailures.penaltyUntil : 0;
  const until = Math.max(localUntil, sharedUntil);
  return until <= now ? 0 : Math.max(1, Math.ceil((until - now) / 1000));
}

/**
 * Record a failure and set the next penalty: doubling past the free budget,
 * capped at the ceiling, so it never passes the point where an operator would
 * rather restart the server than wait.
 */
export function recordAuthFailure(key: string, now = performance.now()): void {
  prune(now);
  const rec = records.get(key) ?? { failures: 0, penaltyUntil: 0, lastSeen: now };
  rec.failures += 1;
  rec.lastSeen = now;
  if (rec.failures >= FREE_AUTH_ATTEMPTS) {
    const grown = 2 ** (rec.failures - FREE_AUTH_ATTEMPTS);
    rec.penaltyUntil = now + Math.min(grown, MAX_AUTH_PENALTY_SECONDS) * 1000;
  }
  records.set(key, rec);

  const aggregate = sharedFailures ?? {
    failures: 0, penaltyUntil: 0, lastSeen: now,
    firstClaimedClient: key, rotatedClaim: false,
  };
  aggregate.rotatedClaim ||= aggregate.firstClaimedClient !== key;
  aggregate.failures += 1;
  aggregate.lastSeen = now;
  if (aggregate.rotatedClaim && aggregate.failures >= FREE_AUTH_ATTEMPTS) {
    const grown = 2 ** (aggregate.failures - FREE_AUTH_ATTEMPTS);
    aggregate.penaltyUntil = now + Math.min(grown, MAX_AUTH_PENALTY_SECONDS) * 1000;
  }
  sharedFailures = aggregate;
}

/**
 * A correct token clears the record outright: holding the token is proof you
 * are not the threat, and a residue would leave an operator one typo from a penalty.
 */
export function clearAuthFailures(key: string): void {
  records.delete(key);
  // Only a correct root credential calls this. A valid browser cookie is not
  // proof of that credential and must not reset the shared guess budget.
  sharedFailures = null;
}

/**
 * How many claimed clients are remembered. Exported because pruning is not
 * observable from a response. The shared record is fixed-size and excluded.
 */
export function authThrottleRecordCount(): number {
  return records.size;
}
