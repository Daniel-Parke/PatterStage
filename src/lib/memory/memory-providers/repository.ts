// ═══════════════════════════════════════════════════════════════
// memory-providers/repository.ts — DB-owned memory provider config
//
// PatterStage (not ~/.hermes/hindsight/config.json) is the source of truth for
// the active memory provider + how to reach it. Editing these rows (via
// /config/memory) changes the endpoint with NO file edits — the fix for the
// recurring port/path/db churn.
// ═══════════════════════════════════════════════════════════════

import { ensureDb, getDb, now } from "@/lib/db";
import { parseJson } from "@/lib/db/parse-json";
import type { MemoryProviderConfig, MemoryProviderType } from "./types";

export interface MemoryProviderRow {
  id: number;
  type: MemoryProviderType;
  label: string;
  enabled: boolean;
  isActive: boolean;
  /** False while this row is still the shipped default nobody has saved. */
  confirmed: boolean;
  config: MemoryProviderConfig;
}

interface RawRow {
  id: number;
  type: string;
  label: string;
  enabled: number;
  is_active: number;
  config_json: string;
  created_at: string;
  updated_at: string;
}

const DEFAULT_CONFIG: MemoryProviderConfig = { host: "127.0.0.1", port: 9177, bank: "hermes" };

function rowToProvider(r: RawRow): MemoryProviderRow {
  return {
    id: r.id,
    type: r.type as MemoryProviderType,
    label: r.label,
    enabled: r.enabled === 1,
    isActive: r.is_active === 1,
    // Has a human ever saved this row, or is it still the shipped guess?
    //
    // Needs no new column: migration 022 seeds created_at and updated_at from
    // the same `datetime('now')`, and every write through updateMemoryProvider
    // stamps updated_at. So "they differ" IS "somebody confirmed it".
    //
    // Why it matters: the seeded default is hindsight@127.0.0.1:9177, and 9177
    // is where a real Hindsight listens. A second install on one machine
    // connects to the first operator's memory and shows their facts as its own.
    // The operator ruled the auto-connect stays -- so the product says out loud
    // that it guessed, until they tell it otherwise (T-0077).
    confirmed: r.updated_at !== r.created_at,
    config: { ...DEFAULT_CONFIG, ...(parseJson<Partial<MemoryProviderConfig>>(r.config_json) ?? {}) },
  };
}

export function listMemoryProviders(): MemoryProviderRow[] {
  ensureDb();
  return (getDb().prepare("SELECT * FROM memory_providers ORDER BY id").all() as RawRow[]).map(
    rowToProvider,
  );
}

/** The active provider row, or null if none is active. */
function getActiveMemoryProviderRow(): MemoryProviderRow | null {
  ensureDb();
  const r = getDb()
    .prepare("SELECT * FROM memory_providers WHERE is_active = 1 ORDER BY id LIMIT 1")
    .get() as RawRow | undefined;
  return r ? rowToProvider(r) : null;
}

/**
 * The active provider's connection config (defaults applied), never throws.
 *
 * THREE OUTCOMES, and the middle one is the fix. An active AND enabled row is
 * used as written. An active row that is DISABLED reports `none` — it used to
 * be ignored in favour of a hardcoded hindsight@127.0.0.1:9177, which is the
 * single most misleading thing this module could do: it is what pointed a
 * throwaway install at a real Hindsight and showed somebody else's memories
 * (T-0077). No row at all keeps the built-in default, because zero-config
 * connect is deliberate and the operator ruled it stays — it is LABELLED rather
 * than removed.
 */
export function getActiveMemoryConfig(): { type: MemoryProviderType; config: MemoryProviderConfig } {
  try {
    const row = getActiveMemoryProviderRow();
    if (row) {
      if (!row.enabled) return { type: "none", config: row.config };
      return { type: row.type, config: row.config };
    }
  } catch {
    /* fall through to the built-in default */
  }
  return { type: "hindsight", config: { ...DEFAULT_CONFIG } };
}

/**
 * The `enabled` value a patch implies, or null to leave it as it is.
 *
 * `makeActive` without an explicit `enabled` means enabled: activating a
 * provider you have just switched off is not a thing anyone means.
 */
function resolveEnabled(patch: { enabled?: boolean; makeActive?: boolean }): number | null {
  if (patch.enabled !== undefined) return patch.enabled ? 1 : 0;
  if (patch.makeActive) return 1;
  return null;
}

/** Update one provider's config + enabled/active flags; makes it the sole active. */
export function updateMemoryProvider(
  type: MemoryProviderType,
  patch: { label?: string; enabled?: boolean; config?: MemoryProviderConfig; makeActive?: boolean },
): MemoryProviderRow | null {
  ensureDb();
  const db = getDb();
  const existing = db.prepare("SELECT * FROM memory_providers WHERE type = ?").get(type) as
    | RawRow
    | undefined;
  const tx = db.transaction(() => {
    if (existing) {
      db.prepare(
        `UPDATE memory_providers
           SET label = COALESCE(?, label),
               enabled = COALESCE(?, enabled),
               config_json = COALESCE(?, config_json),
               updated_at = ?
         WHERE type = ?`,
      ).run(
        patch.label ?? null,
        // makeActive implies enabled. An active-but-disabled row is incoherent,
        // and getActiveMemoryConfig now reports it as `none` rather than
        // silently substituting another provider's endpoint — so a PUT that
        // activated a provider and omitted `enabled` would have switched memory
        // OFF while answering 200 (T-0077).
        resolveEnabled(patch),
        patch.config ? JSON.stringify(patch.config) : null,
        now(),
        type,
      );
    } else {
      db.prepare(
        `INSERT INTO memory_providers (type, label, enabled, is_active, config_json)
         VALUES (?, ?, ?, 0, ?)`,
      ).run(
        type,
        patch.label ?? type,
        resolveEnabled(patch) ?? 0,
        JSON.stringify(patch.config ?? DEFAULT_CONFIG),
      );
    }
    if (patch.makeActive) {
      db.prepare("UPDATE memory_providers SET is_active = 0").run();
      db.prepare("UPDATE memory_providers SET is_active = 1, updated_at = ? WHERE type = ?").run(now(), type);
    }
  });
  tx();
  const r = db.prepare("SELECT * FROM memory_providers WHERE type = ?").get(type) as RawRow | undefined;
  return r ? rowToProvider(r) : null;
}
