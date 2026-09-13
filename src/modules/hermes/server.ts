// modules/hermes/server.ts — the hermes module's server-side capability,
// registered in src/lib/modules/server.ts. Core calls through ServerModule and
// never names this module, which keeps `core-imports-no-module` enforceable.
// Mirrors src/modules/rec-room/server.ts, the module that proved the seam.

import type { ServerModule } from "@/lib/modules/server";
import type { AgentRosterEntry } from "@/lib/agents/roster";
import type { SyncSource } from "@/lib/sync/types";
import type { CronJobEntry } from "@/lib/sessions/session-title";

import { listProfiles } from "./lib/profiles-repository";
import { createProfileSkillsCounter } from "./lib/profile-counts";
import { loadCronJobsMap } from "./lib/cron-jobs";
import { ConfigSync } from "./sync/ConfigSync";
import { seedAgentCatalog, publishSkill } from "./lib/seed-agent-catalog";

export const hermesServerModule: ServerModule = {
  id: "hermes",

  /** The two fields core needs, out of a 17-column row of Hermes file contents.
   * `displayName || slug`: the column is NOT NULL default '', and an empty label
   * in the composer's picker would be unselectable. */
  listAgentRoster: (): AgentRosterEntry[] =>
    listProfiles().map((p) => ({ slug: p.slug, displayName: p.displayName || p.slug })),

  /** ConfigSync only: the other four read-side sources need file PATHS, which
   * AgentWorkspace gives neutrally. This one parses a Hermes config.yaml schema,
   * its duplicate-key quirk and SOUL.md: protocol knowledge, not a path. */
  syncSources: (): SyncSource[] => [new ConfigSync()],

  /** Hermes' own cron/jobs.json, projected to the core-owned CronJobEntry. */
  loadAgentCronJobs: (): Map<string, CronJobEntry> => loadCronJobsMap(),

  /** agent_profiles + agent_root from the bundled seed pack, then pushed to disk. */
  seedAgentCatalog,

  /** Write a seeded core skill through to the Hermes global skills dir. */
  publishSkill,

  /** The SAME skills counter the profile cards use (GET /api/agent/profiles),
   * so the Agents-page performance strip cannot carry a second answer. */
  createAgentSkillsCounter: createProfileSkillsCounter,
};
