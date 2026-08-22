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
  config: MemoryProviderConfig;
}

interface RawRow {
  id: number;
  type: string;
  label: string;
  enabled: number;
  is_active: number;
  config_json: string;
}

const DEFAULT_CONFIG: MemoryProviderConfig = { host: "127.0.0.1", port: 9177, bank: "hermes" };

function rowToProvider(r: RawRow): MemoryProviderRow {
  return {
    id: r.id,
    type: r.type as MemoryProviderType,
    label: r.label,
    enabled: r.enabled === 1,
    isActive: r.is_active === 1,
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

/** The active provider's connection config (defaults applied), never throws. */
export function getActiveMemoryConfig(): { type: MemoryProviderType; config: MemoryProviderConfig } {
  try {
    const row = getActiveMemoryProviderRow();
    if (row && row.enabled) return { type: row.type, config: row.config };
  } catch {
    /* fall through to defaults */
  }
  return { type: "hindsight", config: { ...DEFAULT_CONFIG } };
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
        patch.enabled === undefined ? null : patch.enabled ? 1 : 0,
        patch.config ? JSON.stringify(patch.config) : null,
        now(),
        type,
      );
    } else {
      db.prepare(
        `INSERT INTO memory_providers (type, label, enabled, is_active, config_json)
         VALUES (?, ?, ?, 0, ?)`,
      ).run(type, patch.label ?? type, patch.enabled ? 1 : 0, JSON.stringify(patch.config ?? DEFAULT_CONFIG));
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
