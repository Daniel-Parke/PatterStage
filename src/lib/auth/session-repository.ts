import { getDb } from "@/lib/db";

const UNUSABLE_RETENTION_MS = 30 * 24 * 60 * 60_000;

export interface StoredBrowserSession {
  id: string;
  token_binding: Buffer;
  created_at_ms: number;
  last_active_at_ms: number;
  idle_expires_at_ms: number;
  absolute_expires_at_ms: number;
  revoked_at_ms: number | null;
  boot_generation: string;
}

export type StoredSessionMetadata = Pick<StoredBrowserSession,
  "id" | "created_at_ms" | "last_active_at_ms" | "idle_expires_at_ms" | "absolute_expires_at_ms">;

export function insertBrowserSession(row: {
  id: string;
  secretHash: Buffer;
  createdAtMs: number;
  idleExpiresAtMs: number;
  absoluteExpiresAtMs: number;
  generation: string;
  binding: Buffer;
}, assertCredentialBeforeCommit: () => void): void {
  const database = getDb();
  database.transaction(() => {
    // ADR-0014: the first of idle expiry, absolute expiry or revocation ends
    // usability. Only rows unusable for at least 30 days are removed. An
    // insertion failure rolls the cleanup back; a cleanup failure issues no
    // new browser secret.
    database.prepare(`
      DELETE FROM auth_sessions
      WHERE idle_expires_at_ms <= @cutoff
         OR absolute_expires_at_ms <= @cutoff
         OR revoked_at_ms <= @cutoff
    `).run({ cutoff: row.createdAtMs - UNUSABLE_RETENTION_MS });
    database.prepare(`
      INSERT INTO auth_sessions (
        id, secret_hash, created_at_ms, last_active_at_ms,
        idle_expires_at_ms, absolute_expires_at_ms, revoked_at_ms,
        boot_generation, token_binding
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(row.id, row.secretHash, row.createdAtMs, row.createdAtMs,
      row.idleExpiresAtMs, row.absoluteExpiresAtMs, row.generation, row.binding);
    assertCredentialBeforeCommit();
  })();
}

export function findBrowserSession(secretHash: Buffer): StoredBrowserSession | undefined {
  return getDb().prepare(`
    SELECT id, token_binding, created_at_ms, last_active_at_ms,
      idle_expires_at_ms, absolute_expires_at_ms, revoked_at_ms, boot_generation
    FROM auth_sessions WHERE secret_hash = ?
  `).get(secretHash) as StoredBrowserSession | undefined;
}

/** The conditional write cannot renew a revoked or expired row. */
export function renewStoredBrowserSession(input: {
  now: number;
  idleMs: number;
  secretHash: Buffer;
  generation: string;
  binding: Buffer;
}): boolean {
  const result = getDb().prepare(`
    UPDATE auth_sessions
    SET last_active_at_ms = max(last_active_at_ms, @now),
        idle_expires_at_ms = min(absolute_expires_at_ms,
          max(idle_expires_at_ms, @now + @idleMs))
    WHERE secret_hash = @secretHash AND boot_generation = @generation
      AND token_binding = @binding AND revoked_at_ms IS NULL
      AND idle_expires_at_ms > @now AND absolute_expires_at_ms > @now
  `).run(input);
  return result.changes === 1;
}

export function revokeStoredCurrentSession(input: {
  now: number;
  secretHash: Buffer;
  generation: string;
  binding: Buffer;
}): void {
  getDb().prepare(`
    UPDATE auth_sessions SET revoked_at_ms = ?
    WHERE secret_hash = ? AND boot_generation = ?
      AND token_binding = ? AND revoked_at_ms IS NULL
  `).run(input.now, input.secretHash, input.generation, input.binding);
}

export function listStoredBrowserSessions(input: {
  now: number;
  generation: string;
  binding: Buffer;
}): StoredSessionMetadata[] {
  return getDb().prepare(`
    SELECT id, created_at_ms, last_active_at_ms,
      idle_expires_at_ms, absolute_expires_at_ms
    FROM auth_sessions
    WHERE boot_generation = ? AND token_binding = ? AND revoked_at_ms IS NULL
      AND idle_expires_at_ms > ? AND absolute_expires_at_ms > ?
    ORDER BY created_at_ms DESC, id
  `).all(input.generation, input.binding, input.now, input.now) as StoredSessionMetadata[];
}

export function revokeStoredBrowserSession(input: {
  id: string;
  now: number;
  generation: string;
  binding: Buffer;
}): boolean {
  const result = getDb().prepare(`
    UPDATE auth_sessions SET revoked_at_ms = @now
    WHERE id = @id AND boot_generation = @generation AND token_binding = @binding
      AND revoked_at_ms IS NULL AND idle_expires_at_ms > @now
      AND absolute_expires_at_ms > @now
  `).run(input);
  return result.changes === 1;
}
