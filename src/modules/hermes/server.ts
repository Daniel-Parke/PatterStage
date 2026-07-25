// ═══════════════════════════════════════════════════════════════
// modules/hermes/server.ts — the hermes module's server-side capability
//
// Registered in src/lib/modules/server.ts, the composition root. Core calls
// through the ServerModule interface and never names this module, which is what
// keeps `core-imports-no-module` enforceable everywhere else.
//
// Mirrors src/modules/rec-room/server.ts, the module that proved the seam.
// ═══════════════════════════════════════════════════════════════

import type { ServerModule } from "@/lib/modules/server";
import type { AgentRosterEntry } from "@/lib/agents/roster";
import type { SyncSource } from "@/lib/sync/types";
import type { CronJobEntry } from "@/lib/session-title";

import { listProfiles } from "./lib/profiles-repository";
import { loadCronJobsMap } from "./lib/cron-jobs";
import { ConfigSync } from "./sync/ConfigSync";
import { seedAgentCatalog, publishSkill } from "./lib/seed-agent-catalog";

export const hermesServerModule: ServerModule = {
  id: "hermes",

  /**
   * The two fields core needs about an agent, projected out of a 17-column row
   * whose other fifteen are Hermes file contents.
   *
   * `displayName || slug` because the column is NOT NULL with a '' default, so an
   * unset name is an empty string rather than null, and an empty label in the
   * composer's picker would be unselectable.
   */
  listAgentRoster: (): AgentRosterEntry[] =>
    listProfiles().map((p) => ({ slug: p.slug, displayName: p.displayName || p.slug })),

  /**
   * ConfigSync only. The other four read-side sources stayed in core because they
   * needed file PATHS, which AgentWorkspace already gives them neutrally. This one
   * parses a Hermes config.yaml schema (memory.provider, model.default and its
   * string shorthand), handles a duplicate-key quirk specific to that file, and
   * probes SOUL.md. That is protocol knowledge, not a path.
   */
  syncSources: (): SyncSource[] => [new ConfigSync()],

  /** Hermes' own cron/jobs.json, projected to the core-owned CronJobEntry. */
  loadAgentCronJobs: (): Map<string, CronJobEntry> => loadCronJobsMap(),

  /** agent_profiles + agent_root from the bundled seed pack, then pushed to disk. */
  seedAgentCatalog,

  /** Write a seeded core skill through to the Hermes global skills dir. */
  publishSkill,
};
