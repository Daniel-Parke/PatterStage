import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { readAuthToken, tokenMatches } from "@/lib/api/auth-token";

import { getBootState } from "./boot-state";
import {
  findBrowserSession,
  insertBrowserSession,
  listStoredBrowserSessions,
  renewStoredBrowserSession,
  revokeStoredBrowserSession,
  revokeStoredCurrentSession,
} from "./session-repository";

const IDLE_MS = 30 * 60_000;
const ABSOLUTE_MS = 12 * 60 * 60_000;
const SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

class SessionUnavailableError extends Error {
  constructor() {
    super("Browser session storage is unavailable");
    this.name = "SessionUnavailableError";
  }
}

export class SessionCredentialChangedError extends Error {
  constructor() {
    super("Operator credential changed during session creation");
    this.name = "SessionCredentialChangedError";
  }
}

export interface BrowserSessionMetadata {
  id: string;
  createdAtMs: number;
  lastActiveAtMs: number;
  idleExpiresAtMs: number;
  absoluteExpiresAtMs: number;
}

function currentBinding(verifiedToken?: string): { generation: string; digest: Buffer } {
  const state = getBootState();
  const token = readAuthToken();
  if (!state || !token) throw new SessionUnavailableError();
  // The token file can rotate after a route verifies its caller. Bind a new
  // session only to the same credential; a later rotation invalidates it.
  if (verifiedToken !== undefined && !tokenMatches(verifiedToken, token)) {
    throw new SessionCredentialChangedError();
  }
  return {
    generation: state.generation,
    digest: createHmac("sha256", state.key).update(token).digest(),
  };
}

function hashSecret(secret: string): Buffer | null {
  if (!SECRET_PATTERN.test(secret)) return null;
  const bytes = Buffer.from(secret, "base64url");
  if (bytes.length !== 32 || bytes.toString("base64url") !== secret) return null;
  return createHash("sha256").update(bytes).digest();
}

function assertCurrentCredential(verifiedToken: string): void {
  const token = readAuthToken();
  if (!token) throw new SessionUnavailableError();
  if (!tokenMatches(verifiedToken, token)) {
    throw new SessionCredentialChangedError();
  }
}

/** Insert must commit before its caller attaches the returned secret to a cookie. */
export function createBrowserSession(verifiedToken: string): { secret: string; expiresAtMs: number } {
  const { generation, digest } = currentBinding(verifiedToken);
  const secretBytes = randomBytes(32);
  const secret = secretBytes.toString("base64url");
  const secretHash = createHash("sha256").update(secretBytes).digest();
  const createdAt = Date.now();
  const expiresAtMs = createdAt + ABSOLUTE_MS;
  insertBrowserSession({
    id: randomUUID(),
    secretHash,
    createdAtMs: createdAt,
    idleExpiresAtMs: createdAt + IDLE_MS,
    absoluteExpiresAtMs: expiresAtMs,
    generation,
    binding: digest,
  }, () => assertCurrentCredential(verifiedToken));
  // Recheck before issuing the secret. A rotation inside the transaction
  // rolls back its insert and retention cleanup; a later rotation still
  // prevents delivery, and any already committed row is token-bound.
  assertCurrentCredential(verifiedToken);
  return { secret, expiresAtMs };
}

/** Invalid credentials return null; missing storage or boot state throws. */
export function validateBrowserSession(
  secret: string,
  renew = false,
): { id: string; absoluteExpiresAtMs: number } | null {
  const { generation, digest } = currentBinding();
  const secretHash = hashSecret(secret);
  if (!secretHash) return null;
  const row = findBrowserSession(secretHash);
  if (!row || row.boot_generation !== generation ||
      !Buffer.isBuffer(row.token_binding) || row.token_binding.length !== digest.length ||
      !timingSafeEqual(row.token_binding, digest)) return null;

  // Capture the clock immediately before the SQLite predicate. Equality with
  // either expiry is already expired; a later renewal cannot revive the row.
  const now = Date.now();
  if (row.revoked_at_ms !== null || now >= row.idle_expires_at_ms ||
      now >= row.absolute_expires_at_ms) return null;
  if (renew && !renewStoredBrowserSession({
    now, idleMs: IDLE_MS, secretHash, generation, binding: digest,
  })) return null;
  return { id: row.id, absoluteExpiresAtMs: row.absolute_expires_at_ms };
}

/** Clear the browser cookie independently of whether this row still exists. */
export function revokeCurrentSession(secret: string): void {
  const { generation, digest } = currentBinding();
  const secretHash = hashSecret(secret);
  if (!secretHash) return;
  revokeStoredCurrentSession({
    now: Date.now(), secretHash, generation, binding: digest,
  });
}

/** Return only current, usable sessions; never expose hashes or bindings. */
export function listBrowserSessions(): BrowserSessionMetadata[] {
  const { generation, digest } = currentBinding();
  const now = Date.now();
  const rows = listStoredBrowserSessions({ now, generation, binding: digest });
  return rows.map((row) => ({
    id: row.id,
    createdAtMs: row.created_at_ms,
    lastActiveAtMs: row.last_active_at_ms,
    idleExpiresAtMs: row.idle_expires_at_ms,
    absoluteExpiresAtMs: row.absolute_expires_at_ms,
  }));
}

/** The route must independently demand a freshly supplied operator credential. */
export function revokeBrowserSession(id: string): boolean {
  const { generation, digest } = currentBinding();
  const now = Date.now();
  return revokeStoredBrowserSession({ id, generation, binding: digest, now });
}
