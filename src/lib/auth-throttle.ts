// ═══════════════════════════════════════════════════════════════
// auth-throttle — what a wrong token costs
//
// The `ps_token` compare is constant-time, which closes a timing oracle and
// does nothing about volume. `npm run start:network` binds 0.0.0.0, so on a
// shared network an attacker can try tokens as fast as the event loop will
// take them. Reported as QA finding 13 (no 429 at 130 requests); the operator
// ruled for a failed-auth throttle rather than a general API limiter.
//
// THE PENALTY REFUSES TO PROCESS, and that is the whole point. The gentler
// design — keep comparing, just answer 429 once the client is over budget — is
// decoration: the attacker still gets a comparison on every request and their
// guess rate does not change. Refusing outright is what makes the rate
// collapse.
//
// WHICH IS WHY IT IS SHORT. PatterStage is local-first and its operator is
// usually indistinguishable from an attacker at the network layer, because on
// loopback both are "local". A lock with no ceiling would therefore be a
// denial of service against the operator, shipped as a security feature. The
// ceiling is seconds: an operator who fat-fingers a token waits once, briefly,
// and any correct token clears the record outright. An attacker gets a handful
// of guesses per window, forever.
//
// IN MEMORY, DELIBERATELY. Losing the counters on restart costs one fresh
// window, and an attacker who can restart the server has already won. A table
// would put a write on the hot path of every failed request, which is the one
// request an attacker controls the rate of.
// ═══════════════════════════════════════════════════════════════

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
 * Who is failing.
 *
 * The same derivation the sessions limiter uses, deliberately: two different
 * answers to "which client is this" would be two different security
 * boundaries. Everything on loopback collapses to "local", which is exactly
 * the case the bounded penalty exists to make survivable.
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
  // Bounded by construction: a client that stops failing is forgotten. Without
  // this the map is an unbounded, attacker-controlled allocation.
  for (const [key, rec] of records) {
    if (now - rec.lastSeen > RECORD_TTL_MS) records.delete(key);
  }
}

/**
 * Seconds this client must wait, or 0 if it may proceed.
 *
 * Called BEFORE the token is compared, so a client inside its penalty gets no
 * comparison at all.
 */
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
 * Record a failed authentication and set the next penalty.
 *
 * Doubles per failure past the free budget and stops at the ceiling, so the
 * cost rises fast enough to matter and never past the point where an operator
 * would rather restart the server than wait.
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
 * A correct token clears the record outright rather than decrementing it.
 *
 * Proving you hold the token is proof you are not the thing this guards
 * against, and leaving a residue would mean an operator who mistyped five
 * times then succeeded is still one typo from a penalty.
 */
export function clearAuthFailures(key: string): void {
  records.delete(key);
}

/**
 * How many clients are currently remembered.
 *
 * Exported for one assertion, and it earns its place: `x-forwarded-for` is
 * attacker-controlled, so an unpruned map is an unbounded allocation somebody
 * else decides the size of. That the map SHRINKS is not observable from any
 * response, so without this the pruning could be deleted and nothing would
 * notice.
 *
 * There is deliberately no reset seam beside it: each proxy test calls
 * jest.resetModules() and re-imports, so the module -- and this Map with it --
 * is rebuilt fresh, and an exported clear() would be dead code pretending to
 * be a test affordance.
 */
export function authThrottleRecordCount(): number {
  return records.size;
}
