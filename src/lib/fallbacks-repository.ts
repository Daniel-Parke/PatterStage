// ═══════════════════════════════════════════════════════════════
// fallbacks-repository.ts — CRUD for the global fallback chain
// ═══════════════════════════════════════════════════════════════

import { getDb, inTransaction, uuid, now } from "./db";
import type { FallbackConfig } from "@/types/console";

export interface FallbackEntryRecord {
  id: string;
  modelId: string | null;
  modelName: string;
  provider: string;
  modelIdString: string;
  position: number;
  enabled: boolean;
  overrideBaseUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFallbackInput {
  modelId: string | null;
  position?: number;
  enabled?: boolean;
  overrideBaseUrl?: string | null;
  /** Optional denormalised display fields for custom (non-registry) fallbacks */
  modelName?: string;
  provider?: string;
  modelIdString?: string;
}

export interface UpdateFallbackInput {
  modelId?: string | null;
  position?: number;
  enabled?: boolean;
  overrideBaseUrl?: string | null;
}

// ── Shared SELECT shape + row mapper ─────────────────────────────
//
// The SELECT column list and the row → FallbackEntryRecord projection
// are identical between `listFallbackChain` (full table scan) and
// `getFallbackEntry` (id-keyed lookup). Extracting them to top-level
// constants/functions keeps the two callers in lockstep — adding a new
// field is a one-line edit in each, instead of two-sites-drift risk.

interface FallbackRow {
  id: string; model_id: string | null; position: number;
  enabled: number; override_base_url: string | null;
  created_at: string; updated_at: string;
  model_name: string | null; provider: string | null; model_id_string: string | null;
}

const FALLBACK_JOIN_SELECT = `
  SELECT f.id, f.model_id, f.position, f.enabled, f.override_base_url,
         f.created_at, f.updated_at,
         m.name AS model_name, m.provider, m.model_id AS model_id_string
  FROM model_fallbacks f
  LEFT JOIN models m ON f.model_id = m.id
`;

function rowToFallbackEntry(r: FallbackRow): FallbackEntryRecord {
  return {
    id: r.id,
    modelId: r.model_id,
    modelName: r.model_name ?? "Custom",
    provider: r.provider ?? "custom",
    modelIdString: r.model_id_string ?? "",
    position: r.position,
    enabled: r.enabled === 1,
    overrideBaseUrl: r.override_base_url,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** List the entire fallback chain ordered by position.
 *  Registry entries are joined to models for display info.
 *  Custom entries (no FK) return with denormalised data.
 */
export function listFallbackChain(): FallbackEntryRecord[] {
  const rows = getDb()
    .prepare(`${FALLBACK_JOIN_SELECT} ORDER BY f.position ASC`)
    .all() as FallbackRow[];
  return rows.map(rowToFallbackEntry);
}

/** Get a single fallback entry. */
export function getFallbackEntry(id: string): FallbackEntryRecord | null {
  const row = getDb()
    .prepare(`${FALLBACK_JOIN_SELECT} WHERE f.id = ?`)
    .get(id) as FallbackRow | undefined;
  if (!row) return null;
  return rowToFallbackEntry(row);
}

/** Add a new entry to the chain. Auto-positions at end if position omitted. */
export function addFallbackEntry(input: CreateFallbackInput): FallbackEntryRecord {
  const ts = now();
  const id = uuid();
  const maxPos = getDb()
    .prepare("SELECT COALESCE(MAX(position), 0) AS mx FROM model_fallbacks")
    .get() as { mx: number };
  const position = input.position ?? maxPos.mx + 1;
  // Default to enabled (1) unless explicitly set to false
  const enabled = input.enabled !== false ? 1 : 0;

  getDb().prepare(
    `INSERT INTO model_fallbacks (id, model_id, position, enabled, override_base_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.modelId, position, enabled, input.overrideBaseUrl ?? null, ts, ts);

  // For registry-backed entries, return the JOIN'd row
  if (input.modelId) {
    return getFallbackEntry(id)!;
  }
  // Custom entries have no FK to models — return denormalised record
  return {
    id,
    modelId: input.modelId,
    modelName: input.modelName ?? "Custom",
    provider: input.provider ?? "custom",
    modelIdString: input.modelIdString ?? "",
    position,
    enabled: enabled === 1,
    overrideBaseUrl: input.overrideBaseUrl ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
}

/** Update an existing fallback entry. */
export function updateFallbackEntry(id: string, input: UpdateFallbackInput): FallbackEntryRecord | null {
  const existing = getFallbackEntry(id);
  if (!existing) return null;

  const ts = now();
  const sets: string[] = ["updated_at = ?"];
  const vals: unknown[] = [ts];

  if (input.modelId !== undefined) { sets.push("model_id = ?"); vals.push(input.modelId); }
  if (input.position !== undefined) { sets.push("position = ?"); vals.push(input.position); }
  if (input.enabled !== undefined) { sets.push("enabled = ?"); vals.push(input.enabled ? 1 : 0); }
  if (input.overrideBaseUrl !== undefined) { sets.push("override_base_url = ?"); vals.push(input.overrideBaseUrl); }

  vals.push(id);
  getDb().prepare(`UPDATE model_fallbacks SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return getFallbackEntry(id);
}

/** Toggle the enabled flag of a fallback entry. */
export function toggleFallbackEntry(id: string, enabled: boolean): FallbackEntryRecord | null {
  return updateFallbackEntry(id, { enabled });
}

/** Delete a fallback entry and reposition remaining entries to close the gap. */
export function deleteFallbackEntry(id: string): boolean {
  const entry = getFallbackEntry(id);
  if (!entry) return false;

  inTransaction(() => {
    getDb().prepare("DELETE FROM model_fallbacks WHERE id = ?").run(id);
    // Reposition entries that were after the deleted one
    getDb().prepare(
      "UPDATE model_fallbacks SET position = position - 1 WHERE position > ?"
    ).run(entry.position);
  });

  return true;
}

// ── Fallback Behaviour Config ─────────────────────────────────

interface ConfigRow {
  key: string;
  value: string;
}

export function getFallbackConfig(): FallbackConfig {
  const rows = getDb()
    .prepare("SELECT key, value FROM fallback_config")
    .all() as ConfigRow[];

  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));

  return {
    restorePrimaryOnFallback: map.restore_primary_on_fallback === "true",
    fallbackNotification: map.fallback_notification === "true",
    apiMaxRetries: parseInt(map.api_max_retries ?? "3", 10),
  };
}

/** Bulk update of fallback behaviour config. Returns updated config. */
export function updateFallbackConfigBatch(updates: {
  restorePrimaryOnFallback?: boolean;
  fallbackNotification?: boolean;
  apiMaxRetries?: number;
}): FallbackConfig {
  // The pre-refactor form was 3 hand-listed `if (X !== undefined) {
  // getDb().prepare(...).run(KEY, String(X)) }` blocks — same SQL string,
  // same `.run(key, stringified-value)` shape. The loop collapses them
  // to a single prepared statement (better-sqlite3 caches by SQL text,
  // so reuse is a wash but the byte-for-byte wire shape is preserved).
  // `getFallbackConfig` at the end is unchanged (it re-reads all rows
  // and returns the full object, so a partial batch is safe).
  const stmt = getDb().prepare(
    "INSERT OR REPLACE INTO fallback_config (key, value) VALUES (?, ?)"
  );
  const entries: Array<[string, unknown]> = [
    ["restore_primary_on_fallback", updates.restorePrimaryOnFallback],
    ["fallback_notification", updates.fallbackNotification],
    ["api_max_retries", updates.apiMaxRetries],
  ];
  for (const [key, value] of entries) {
    if (value !== undefined) stmt.run(key, String(value));
  }
  return getFallbackConfig();
}
