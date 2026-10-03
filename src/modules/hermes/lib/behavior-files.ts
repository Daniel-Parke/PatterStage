// Shared behavior file definitions — paths follow active Hermes install
import { getActiveHermesPaths } from "./agent-runtime";

export type BehaviorFileEntry = {
  name: string;
  path: string;
  description: string;
  category: string;
};

/**
 * Return the set of known behaviour files for the active Hermes install.
 * Each entry maps a logical key (e.g. `"soul"`) to its display name, resolved
 * filesystem path, and category.
 */
export function getBehaviorFiles(): Record<string, BehaviorFileEntry> {
  const H = getActiveHermesPaths();
  return {
    soul: {
      name: "SOUL.md",
      path: H.soul,
      description: "Agent persona — defines personality, tone, and behavior",
      category: "identity",
    },
    hermes: {
      name: "HERMES.md",
      path: H.hermes,
      description: "Priority project instructions (loaded every message)",
      category: "identity",
    },
    user: {
      name: "USER.md",
      path: H.userMemory,
      description: "User priorities and preferences",
      category: "user",
    },
    memory: {
      name: "MEMORY.md",
      path: H.agentMemory,
      description: "Agent persistent knowledge and memories",
      category: "user",
    },
    agent: {
      name: "AGENTS.md",
      path: H.agents,
      description: "Agent development rules and guidelines",
      category: "identity",
    },
    env: {
      name: ".env",
      path: H.env,
      description: "API keys and environment variables",
      category: "system",
    },
    config: {
      name: "config.yaml",
      path: H.config,
      description: "Core configuration — model, provider, display, tools",
      category: "system",
    },
  };
}
