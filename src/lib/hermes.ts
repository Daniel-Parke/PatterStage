// ═══════════════════════════════════════════════════════════════
// hermes.ts — DEPRECATED backward-compatibility re-export + Hermes aliases
// ═══════════════════════════════════════════════════════════════
// DEPRECATED: All new code should import from lib/paths.ts instead.
// This file exists solely for backward compatibility with existing
// imports and will be removed in a future release.
// ─────────────────────────────────────────────────────────────
// @deprecated since Control Hub v1.4 — import from paths.ts

export {
  AGENT_HOME,
  CH_DATA_DIR,
  getChDataDir,
  PATHS,
  getConfigValue,
  getDefaultModelConfig,
} from "./paths";

import { AGENT_HOME, PATHS } from "./paths";

// Hermes-specific aliases (for backward compat with existing imports)
export const HERMES_HOME = AGENT_HOME;

// Deferred routes still use PATHS.env, PATHS.sessions, etc.
// Map Hermes-specific keys to agent-prefixed PATHS keys
const _paths = PATHS as Record<string, string>;

export const HERMES_PATHS = {
  env:       _paths.agentEnv,
  soul:      _paths.agentSoul,
  hermes:    _paths.agentHermes,
  agents:    _paths.agentAgents,
  skills:    _paths.agentSkills,
  profiles:  _paths.agentProfiles,
  sessions:  _paths.agentSessions,
  logs:      _paths.agentLogs,
  config:    _paths.agentConfig,
  backups:   _paths.agentBackups,
  cronJobs:  _paths.agentCronJobs,
  memoryDb:  _paths.agentMemoryDb,
  userMd:     _paths.agentEnv,
  memoryMd:   _paths.agentMemoryDb,
} as const;
