// ═══════════════════════════════════════════════════════════════
// tool-catalog-repository.ts — canonical default TOOL bundles (fair-test pillar)
//
// A tool bundle is a named set of Hermes toolset ids (e.g. "research" →
// [web, browser, session_search]). Bundled entries (source='bundled') ship with
// the install; the benchmark builder toggles them on a fair-test agent. CH-DB
// owned — independent of any user/agent. See [[phase-b-benchmarking]].
// ═══════════════════════════════════════════════════════════════

import { getDb, now } from "./db";

type ToolSource = "bundled" | "custom";

export interface ToolBundle {
  toolKey: string;
  displayName: string;
  description: string;
  toolsetIds: string[];
  category: string;
  source: ToolSource;
  seedKey: string | null;
}

interface DbRow {
  tool_key: string;
  display_name: string;
  description: string;
  toolset_ids: string;
  category: string;
  source: string;
  seed_key: string | null;
}

function parseIds(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}

function rowToBundle(row: DbRow): ToolBundle {
  return {
    toolKey: row.tool_key,
    displayName: row.display_name,
    description: row.description,
    toolsetIds: parseIds(row.toolset_ids),
    category: row.category,
    source: row.source as ToolSource,
    seedKey: row.seed_key,
  };
}

export function getToolBundle(toolKey: string): ToolBundle | null {
  try {
    const row = getDb().prepare("SELECT * FROM tool_catalog WHERE tool_key = ?").get(toolKey) as DbRow | undefined;
    return row ? rowToBundle(row) : null;
  } catch {
    return null;
  }
}

export interface UpsertToolBundleInput {
  toolKey: string;
  displayName?: string;
  description?: string;
  toolsetIds: string[];
  category?: string;
  source?: ToolSource;
  seedKey?: string | null;
}

export function upsertToolBundle(input: UpsertToolBundleInput): void {
  const ts = now();
  getDb()
    .prepare(
      `INSERT INTO tool_catalog (tool_key, display_name, description, toolset_ids, category, source, seed_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tool_key) DO UPDATE SET
         display_name = excluded.display_name,
         description  = excluded.description,
         toolset_ids  = excluded.toolset_ids,
         category     = excluded.category,
         source       = COALESCE(excluded.source, tool_catalog.source),
         seed_key     = COALESCE(excluded.seed_key, tool_catalog.seed_key),
         updated_at   = excluded.updated_at`,
    )
    .run(
      input.toolKey,
      input.displayName ?? "",
      input.description ?? "",
      JSON.stringify(input.toolsetIds),
      input.category ?? "",
      input.source ?? "custom",
      input.seedKey ?? null,
      ts,
      ts,
    );
}
