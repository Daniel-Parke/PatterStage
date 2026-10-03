// ═══════════════════════════════════════════════════════════════
// frameworks/repository.ts — DB-owned agent-framework registry
//
// PatterStage records WHICH agent framework backs the control plane + its home
// config in the `frameworks` table (mirrors memory-providers/repository.ts), so
// the active framework is data, not a hardcode.
// ═══════════════════════════════════════════════════════════════

import { ensureDb, getDb, now } from "@/lib/db";
import { parseJson } from "@/lib/db/parse-json";
import type { FrameworkConfig, FrameworkType } from "./types";

export interface FrameworkRow {
  id: number;
  type: FrameworkType;
  name: string;
  enabled: boolean;
  isActive: boolean;
  config: FrameworkConfig;
}

interface RawRow {
  id: number;
  type: string;
  name: string;
  enabled: number;
  is_active: number;
  config_json: string;
}

const DEFAULT_CONFIG: FrameworkConfig = { home: null };

function rowToFramework(r: RawRow): FrameworkRow {
  return {
    id: r.id,
    type: r.type as FrameworkType,
    name: r.name,
    enabled: r.enabled === 1,
    isActive: r.is_active === 1,
    config: { ...DEFAULT_CONFIG, ...(parseJson<Partial<FrameworkConfig>>(r.config_json) ?? {}) },
  };
}

export function listFrameworks(): FrameworkRow[] {
  ensureDb();
  return (getDb().prepare("SELECT * FROM frameworks ORDER BY id").all() as RawRow[]).map(rowToFramework);
}

/** The active framework row, or null if none is active. */
function getActiveFrameworkRow(): FrameworkRow | null {
  ensureDb();
  const r = getDb()
    .prepare("SELECT * FROM frameworks WHERE is_active = 1 ORDER BY id LIMIT 1")
    .get() as RawRow | undefined;
  return r ? rowToFramework(r) : null;
}

/** The active framework's type + config (defaults applied), never throws. */
export function getActiveFrameworkConfig(): { type: FrameworkType; config: FrameworkConfig } {
  try {
    const row = getActiveFrameworkRow();
    if (row) return { type: row.type, config: row.config };
  } catch {
    /* fall through to the Hermes default */
  }
  return { type: "hermes", config: { ...DEFAULT_CONFIG } };
}

/** Update one framework's config + flags; makes it the sole active when asked. */
export function updateFramework(
  type: FrameworkType,
  patch: { name?: string; enabled?: boolean; config?: FrameworkConfig; makeActive?: boolean },
): FrameworkRow | null {
  ensureDb();
  const db = getDb();
  const existing = db.prepare("SELECT * FROM frameworks WHERE type = ?").get(type) as RawRow | undefined;
  const tx = db.transaction(() => {
    if (existing) {
      db.prepare(
        `UPDATE frameworks
           SET name = COALESCE(?, name),
               enabled = COALESCE(?, enabled),
               config_json = COALESCE(?, config_json),
               updated_at = ?
         WHERE type = ?`,
      ).run(
        patch.name ?? null,
        patch.enabled === undefined ? null : patch.enabled ? 1 : 0,
        patch.config ? JSON.stringify(patch.config) : null,
        now(),
        type,
      );
    } else {
      db.prepare(
        `INSERT INTO frameworks (type, name, enabled, is_active, config_json) VALUES (?, ?, ?, 0, ?)`,
      ).run(type, patch.name ?? type, patch.enabled ? 1 : 0, JSON.stringify(patch.config ?? DEFAULT_CONFIG));
    }
    if (patch.makeActive) {
      db.prepare("UPDATE frameworks SET is_active = 0").run();
      db.prepare("UPDATE frameworks SET is_active = 1, updated_at = ? WHERE type = ?").run(now(), type);
    }
  });
  tx();
  const r = db.prepare("SELECT * FROM frameworks WHERE type = ?").get(type) as RawRow | undefined;
  return r ? rowToFramework(r) : null;
}
