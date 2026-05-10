// ═══════════════════════════════════════════════════════════════
// credentials-repository.ts — CRUD for provider API key records
// ═══════════════════════════════════════════════════════════════
//
// Plaintext storage by design (matches ~/.hermes/.env posture; no
// app-level encryption per the user-models-registry design constraints).
// Listing endpoints expose only `keyHint`, never `apiKey`.

import { db, inTransaction, uuid, now } from "./db";
import type { HermesProvider } from "./hermes-providers";

// ── Public types ────────────────────────────────────────────────

/** Public-facing credential record (no api_key, hint only). */
export interface CredentialSummary {
  id: string;
  label: string;
  provider: string;
  keyHint: string;
  createdAt: string;
  updatedAt: string;
}

/** Internal-only credential record including the plaintext key. */
export interface CredentialWithKey extends CredentialSummary {
  apiKey: string;
}

export interface CreateCredentialInput {
  label: string;
  provider: string;
  apiKey: string;
}

export interface UpdateCredentialInput {
  label?: string;
  provider?: string;
  /** Provide to rotate; omit to keep existing. */
  apiKey?: string;
}

// ── Row shape ──────────────────────────────────────────────────

interface CredentialRow {
  id: string;
  label: string;
  provider: string;
  api_key: string;
  key_hint: string;
  created_at: string;
  updated_at: string;
}

function toSummary(row: CredentialRow): CredentialSummary {
  return {
    id: row.id,
    label: row.label,
    provider: row.provider,
    keyHint: row.key_hint,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toWithKey(row: CredentialRow): CredentialWithKey {
  return { ...toSummary(row), apiKey: row.api_key };
}

/**
 * Compute a safe display hint for an API key. Mirrors the existing
 * convention used elsewhere in Control Hub (e.g. `sk-...abcd`).
 */
export function buildKeyHint(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length === 0) return "";
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}...${trimmed.slice(-2)}`;
  const prefix = trimmed.slice(0, Math.min(4, trimmed.length - 4));
  const suffix = trimmed.slice(-4);
  return `${prefix}...${suffix}`;
}

// ── CRUD ───────────────────────────────────────────────────────

export function listCredentials(): CredentialSummary[] {
  const rows = db()
    .prepare("SELECT * FROM credentials ORDER BY created_at DESC")
    .all() as CredentialRow[];
  return rows.map(toSummary);
}

export function getCredential(id: string): CredentialSummary | null {
  const row = db()
    .prepare("SELECT * FROM credentials WHERE id = ?")
    .get(id) as CredentialRow | undefined;
  return row ? toSummary(row) : null;
}

/**
 * Reads a credential including the plaintext API key. Internal use only —
 * never expose this from a list/GET API. Used by hermes-config-sync.ts
 * and the LLM dispatch path.
 */
export function getCredentialWithKey(id: string): CredentialWithKey | null {
  const row = db()
    .prepare("SELECT * FROM credentials WHERE id = ?")
    .get(id) as CredentialRow | undefined;
  return row ? toWithKey(row) : null;
}

export function createCredential(input: CreateCredentialInput): CredentialSummary {
  if (!input.label || input.label.trim().length === 0) {
    throw new Error("label is required");
  }
  if (!input.provider || input.provider.trim().length === 0) {
    throw new Error("provider is required");
  }
  if (!input.apiKey || input.apiKey.trim().length === 0) {
    throw new Error("apiKey is required");
  }

  const id = uuid();
  const ts = now();
  const hint = buildKeyHint(input.apiKey);

  inTransaction(() => {
    db()
      .prepare(
        `INSERT INTO credentials (id, label, provider, api_key, key_hint, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.label.trim(), input.provider.trim(), input.apiKey.trim(), hint, ts, ts);
  });

  return getCredential(id)!;
}

export function updateCredential(
  id: string,
  input: UpdateCredentialInput
): CredentialSummary | null {
  const existing = db()
    .prepare("SELECT * FROM credentials WHERE id = ?")
    .get(id) as CredentialRow | undefined;
  if (!existing) return null;

  const ts = now();
  const sets: string[] = ["updated_at = ?"];
  const vals: unknown[] = [ts];

  if (input.label !== undefined) {
    sets.push("label = ?");
    vals.push(input.label.trim());
  }
  if (input.provider !== undefined) {
    sets.push("provider = ?");
    vals.push(input.provider.trim());
  }
  if (input.apiKey !== undefined && input.apiKey.trim().length > 0) {
    sets.push("api_key = ?");
    vals.push(input.apiKey.trim());
    sets.push("key_hint = ?");
    vals.push(buildKeyHint(input.apiKey));
  }

  vals.push(id);

  inTransaction(() => {
    db().prepare(`UPDATE credentials SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  });

  return getCredential(id);
}

export function deleteCredential(id: string): boolean {
  const result = db().prepare("DELETE FROM credentials WHERE id = ?").run(id);
  return result.changes > 0;
}

// ── Upsert (used by hermes-import.ts / prebuild-db.mjs) ────────

export interface UpsertCredentialResult {
  id: string;
  action: "inserted" | "updated";
}

/**
 * Idempotent upsert: insert a credential if no row for this provider
 * exists, otherwise update the API key if it changed.
 *
 * Credentials are matched by `provider` (unique constraint).
 * Used by hermes-import.ts so re-importing the same .env
 * never creates duplicate credential rows.
 */
export function upsertCredential(input: {
  provider: HermesProvider;
  apiKey: string;
}): UpsertCredentialResult {
  const existing = db()
    .prepare("SELECT id, api_key FROM credentials WHERE provider = ?")
    .get(input.provider) as { id: string; api_key: string } | undefined;

  const hint = buildKeyHint(input.apiKey);
  const ts = now();

  if (existing) {
    if (existing.api_key !== input.apiKey) {
      db()
        .prepare(
          "UPDATE credentials SET api_key = ?, key_hint = ?, updated_at = ? WHERE id = ?"
        )
        .run(input.apiKey, hint, ts, existing.id);
    }
    return { id: existing.id, action: "updated" };
  }

  const id = uuid();
  inTransaction(() => {
    db()
      .prepare(
        `INSERT INTO credentials (id, label, provider, api_key, key_hint, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, `${input.provider} key`, input.provider, input.apiKey, hint, ts, ts);
  });
  return { id, action: "inserted" };
}
