// ═══════════════════════════════════════════════════════════════
// agent-root-repository.ts — Bob / default agent at HERMES_HOME root
// ═══════════════════════════════════════════════════════════════

import { getDb, now } from "./db";

export interface AgentRootRow {
  id: number;
  displayName: string;
  description: string;
  personality: string;
  configYaml: string;
  soulMd: string;
  agentsMd: string;
  frameworkMd: string;
  userMd: string;
  memoryMd: string;
  disabledSkillsJson: string;
  platformToolsetsJson: string;
  syncedAt: string | null;
  syncError: string | null;
  updatedAt: string;
}

interface DbRow {
  id: number;
  display_name: string;
  description: string;
  personality: string;
  config_yaml: string;
  soul_md: string;
  agents_md: string;
  framework_md: string;
  user_md: string;
  memory_md: string;
  disabled_skills: string;
  platform_toolsets: string;
  synced_at: string | null;
  sync_error: string | null;
  updated_at: string;
}

const SELECT_COLS = `
  id, display_name, description, personality, config_yaml,
  soul_md, agents_md, framework_md, user_md, memory_md,
  disabled_skills, platform_toolsets, synced_at, sync_error, updated_at
`;

function rowToAgentRoot(row: DbRow): AgentRootRow {
  return {
    id: row.id,
    displayName: row.display_name,
    description: row.description,
    personality: row.personality,
    configYaml: row.config_yaml,
    soulMd: row.soul_md,
    agentsMd: row.agents_md,
    frameworkMd: row.framework_md,
    userMd: row.user_md,
    memoryMd: row.memory_md,
    disabledSkillsJson: row.disabled_skills,
    platformToolsetsJson: row.platform_toolsets,
    syncedAt: row.synced_at,
    syncError: row.sync_error,
    updatedAt: row.updated_at,
  };
}

export function getAgentRoot(): AgentRootRow {
  const row = getDb()
    .prepare(`SELECT ${SELECT_COLS} FROM agent_root WHERE id = 1`)
    .get() as DbRow | undefined;
  if (!row) {
    getDb()
      .prepare(
        `INSERT INTO agent_root (id, display_name, description) VALUES (1, 'Bob', 'Main agent')`,
      )
      .run();
    return getAgentRoot();
  }
  return rowToAgentRoot(row);
}

export interface AgentRootPatch {
  displayName?: string;
  description?: string;
  personality?: string;
  configYaml?: string;
  soulMd?: string;
  agentsMd?: string;
  frameworkMd?: string;
  userMd?: string;
  memoryMd?: string;
  disabledSkillsJson?: string;
  platformToolsetsJson?: string;
}

export function updateAgentRoot(patch: AgentRootPatch): AgentRootRow {
  const existing = getAgentRoot();
  const ts = now();
  getDb()
    .prepare(
      `UPDATE agent_root SET
        display_name = ?,
        description = ?,
        personality = ?,
        config_yaml = ?,
        soul_md = ?,
        agents_md = ?,
        framework_md = ?,
        user_md = ?,
        memory_md = ?,
        disabled_skills = ?,
        platform_toolsets = ?,
        updated_at = ?
      WHERE id = 1`,
    )
    .run(
      patch.displayName ?? existing.displayName,
      patch.description ?? existing.description,
      patch.personality ?? existing.personality,
      patch.configYaml ?? existing.configYaml,
      patch.soulMd ?? existing.soulMd,
      patch.agentsMd ?? existing.agentsMd,
      patch.frameworkMd ?? existing.frameworkMd,
      patch.userMd ?? existing.userMd,
      patch.memoryMd ?? existing.memoryMd,
      patch.disabledSkillsJson ?? existing.disabledSkillsJson,
      patch.platformToolsetsJson ?? existing.platformToolsetsJson,
      ts,
    );
  return getAgentRoot();
}

export function setAgentRootSyncStatus(syncedAt: string | null, syncError: string | null): void {
  getDb()
    .prepare("UPDATE agent_root SET synced_at = ?, sync_error = ?, updated_at = ? WHERE id = 1")
    .run(syncedAt, syncError, now());
}
