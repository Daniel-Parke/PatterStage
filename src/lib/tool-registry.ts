// ═══════════════════════════════════════════════════════════════
// tool-registry.ts — MCP tool plugin registry
// ═══════════════════════════════════════════════════════════════
// Provides CRUD for tool plugins and seeds default Hermes tools.

import { db, inTransaction, uuid, now } from "./db";
import type { ToolDefinition } from "./agent-backend/types";  // HMS dispatch types

// ── Row shape ─────────────────────────────────────────────────

interface ToolRow {
  id: string;
  name: string;
  label: string;
  description: string;
  category: string;
  enabled: number;
  config: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function rowToTool(row: ToolRow | undefined): ToolDefinition | null {
  if (!row || row.deleted_at) return null;
  return {
    id: row.id,
    name: row.name,
    label: row.label,
    description: row.description,
    category: row.category as ToolDefinition["category"],
    enabled: Boolean(row.enabled),
    config: JSON.parse(row.config || "{}"),
  };
}

// ── Default Hermes tools ──────────────────────────────────────

const HERMES_DEFAULT_TOOLS: Omit<ToolDefinition, "id">[] = [
  {
    name: "hermes-cli",
    label: "Hermes CLI",
    description: "Full Hermes CLI toolset — all core tools",
    category: "platform",
    enabled: true,
    config: { toolset: "hermes-cli" },
  },
  {
    name: "hermes-telegram",
    label: "Hermes Telegram",
    description: "Telegram gateway toolset",
    category: "platform",
    enabled: false,
    config: { toolset: "hermes-telegram" },
  },
  {
    name: "hermes-discord",
    label: "Hermes Discord",
    description: "Discord gateway toolset",
    category: "platform",
    enabled: false,
    config: { toolset: "hermes-discord" },
  },
  {
    name: "hermes-slack",
    label: "Hermes Slack",
    description: "Slack gateway toolset",
    category: "platform",
    enabled: false,
    config: { toolset: "hermes-slack" },
  },
  {
    name: "hermes-whatsapp",
    label: "Hermes WhatsApp",
    description: "WhatsApp gateway toolset",
    category: "platform",
    enabled: false,
    config: { toolset: "hermes-whatsapp" },
  },
  {
    name: "hermes-signal",
    label: "Hermes Signal",
    description: "Signal gateway toolset",
    category: "platform",
    enabled: false,
    config: { toolset: "hermes-signal" },
  },
  {
    name: "hermes-homeassistant",
    label: "Hermes Home Assistant",
    description: "Home Assistant gateway toolset",
    category: "platform",
    enabled: false,
    config: { toolset: "hermes-homeassistant" },
  },
  {
    name: "code-execution",
    label: "Code Execution",
    description: "Run Python scripts that call Hermes tools programmatically",
    category: "core",
    enabled: true,
    config: { toolset: "code_execution" },
  },
  {
    name: "kanban",
    label: "Kanban Board",
    description: "Multi-agent coordination Kanban board",
    category: "core",
    enabled: true,
    config: { toolset: "kanban" },
  },
  {
    name: "memory",
    label: "Memory (Hindsight)",
    description: "Hindsight persistent memory",
    category: "core",
    enabled: true,
    config: { toolset: "memory" },
  },
  {
    name: "web-search",
    label: "Web Search",
    description: "Free web search via DuckDuckGo, arXiv, CrossRef, Wikipedia",
    category: "core",
    enabled: true,
    config: { toolset: "web_search" },
  },
];

// ── Seed on first run ─────────────────────────────────────────

let _seeded = false;

export function seedTools(): void {
  if (_seeded) return;
  _seeded = true;

  try {
    const existing = listTools();
    if (existing.length > 0) return; // already seeded

    inTransaction(() => {
      for (const tool of HERMES_DEFAULT_TOOLS) {
        db()
          .prepare(
            `INSERT INTO tool_plugins (id, name, label, description, category, enabled, config, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            uuid(),
            tool.name,
            tool.label,
            tool.description,
            tool.category,
            tool.enabled ? 1 : 0,
            JSON.stringify(tool.config),
            now(),
            now()
          );
      }
    });
  } catch {
    // Table may not exist during build page data collection — skip seeding
  }
}

// ── CRUD ─────────────────────────────────────────────────────

export function listTools(): ToolDefinition[] {
  const rows = db()
    .prepare(
      "SELECT * FROM tool_plugins WHERE deleted_at IS NULL ORDER BY category, label"
    )
    .all() as ToolRow[];
  return rows.map(rowToTool).filter(Boolean) as ToolDefinition[];
}

export function getTool(id: string): ToolDefinition | null {
  const row = db()
    .prepare("SELECT * FROM tool_plugins WHERE id = ?")
    .get(id) as ToolRow | undefined;
  return rowToTool(row);
}

export function getToolByName(name: string): ToolDefinition | null {
  const row = db()
    .prepare("SELECT * FROM tool_plugins WHERE name = ?")
    .get(name) as ToolRow | undefined;
  return rowToTool(row);
}

export function createTool(
  data: Omit<ToolDefinition, "id">
): ToolDefinition {
  const id = uuid();
  const ts = now();

  inTransaction(() => {
    db()
      .prepare(
        `INSERT INTO tool_plugins (id, name, label, description, category, enabled, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.name,
        data.label,
        data.description,
        data.category,
        data.enabled ? 1 : 0,
        JSON.stringify(data.config),
        ts,
        ts
      );
  });

  return getTool(id)!;
}

export function updateTool(
  id: string,
  updates: Partial<Omit<ToolDefinition, "id">>
): ToolDefinition | null {
  const existing = getTool(id);
  if (!existing) return null;
  const ts = now();

  inTransaction(() => {
    db()
      .prepare(
        `UPDATE tool_plugins SET
           name = COALESCE(?, name),
           label = COALESCE(?, label),
           description = COALESCE(?, description),
           category = COALESCE(?, category),
           enabled = COALESCE(?, enabled),
           config = COALESCE(?, config),
           updated_at = ?
         WHERE id = ?`
      )
      .run(
        updates.name ?? null,
        updates.label ?? null,
        updates.description ?? null,
        updates.category ?? null,
        updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : null,
        updates.config !== undefined ? JSON.stringify(updates.config) : null,
        ts,
        id
      );
  });

  return getTool(id);
}

export function configureTool(id: string, enabled: boolean): boolean {
  const existing = getTool(id);
  if (!existing) return false;
  const ts = now();
  db()
    .prepare("UPDATE tool_plugins SET enabled = ?, updated_at = ? WHERE id = ?")
    .run(enabled ? 1 : 0, ts, id);
  return true;
}

export function deleteTool(id: string): boolean {
  const existing = getTool(id);
  if (!existing) return false;
  const ts = now();
  db()
    .prepare("UPDATE tool_plugins SET deleted_at = ? WHERE id = ?")
    .run(ts, id);
  return true;
}
