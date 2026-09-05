// ═══════════════════════════════════════════════════════════════
// paths.ts — Hermes filesystem layout from a single root
// ═══════════════════════════════════════════════════════════════

/** Trailing-slash-normalise a directory path. Exported for reuse. */
export function normPath(root: string): string {
  return root.replace(/[/\\]+$/, "");
}

/** All Hermes-relative paths for one install root (string concat for bundlers). */
export interface HermesPathBundle {
  root: string;
  env: string;
  auth: string;
  soul: string;
  hermes: string;
  agents: string;
  skills: string;
  profiles: string;
  sessions: string;
  logs: string;
  config: string;
  backups: string;
  cronJobs: string;
  memoryDb: string;
  memoriesDir: string;
  userMemory: string;
  agentMemory: string;
  activeProfile: string;
  hindsightConfig: string;
}

export function buildHermesPathBundle(root: string): HermesPathBundle {
  const R = normPath(root);
  return {
    root: R,
    env: R + "/.env",
    auth: R + "/auth.json",
    soul: R + "/SOUL.md",
    hermes: R + "/HERMES.md",
    agents: R + "/AGENTS.md",
    skills: R + "/skills",
    profiles: R + "/profiles",
    sessions: R + "/sessions",
    logs: R + "/logs",
    config: R + "/config.yaml",
    backups: R + "/backups",
    cronJobs: R + "/cron/jobs.json",
    memoryDb: R + "/memory_store.db",
    memoriesDir: R + "/memories",
    userMemory: R + "/memories/USER.md",
    agentMemory: R + "/memories/MEMORY.md",
    activeProfile: R + "/active_profile",
    hindsightConfig: R + "/hindsight/config.json",
  };
}
