// ═══════════════════════════════════════════════════════════════
// modules/server.ts — the composition root for server-side module capability
//
// `registry.ts` is pure data so the e2e matrix can import it from plain node,
// which means it cannot carry FUNCTIONS. This is the one place allowed to
// import module code: core calls the interface below and never names a module,
// which keeps `core-imports-no-module` enforceable everywhere else (the same
// shape as PatterStack's `build_server(extra_tools=discover_product_tools())`,
// a root both sides depend on). Adding a module means adding one entry here.
// ═══════════════════════════════════════════════════════════════

import { recRoomServerModule } from "@/modules/rec-room/server";
import { hermesServerModule } from "@/modules/hermes/server";

/** A dev-data record a module owns, for the "clean dev data" tool. */
export interface DevDataRecord {
  id: string;
  /** Shown to the operator, and what core matches its test-name pattern against. */
  label: string;
}

/** The side-effectful half of a ProductModule. Everything is optional. */
export interface ServerModule {
  /** Must match the `id` of the same module in registry.ts. */
  id: string;
  /** Records this module would delete if the operator cleans dev data. */
  listDevData?: () => DevDataRecord[];
  /** Delete one of its own records by id. */
  deleteDevData?: (id: string) => void;
  /**
   * Agents this module can dispatch to, as {slug, displayName} and not the
   * module row: agent_profiles is the hermes module's (ADR-0005 rule 2), and
   * core only needs WHICH agents exist. See src/lib/agents/roster.ts.
   */
  listAgentRoster?: () => import("@/lib/agents/roster").AgentRosterEntry[];
  /**
   * Read-side sync sources this module contributes. Core owns the SyncSource
   * contract and the scheduler; a module owns the sources that read ITS store
   * (ConfigSync parses Hermes' config.yaml and probes SOUL.md). The four that
   * only needed FILE PATHS stayed in core, under AgentWorkspace.
   */
  syncSources?: () => import("@/lib/sync/types").SyncSource[];
  /**
   * The agent's recurring jobs by id, for session titling, as the core-owned
   * CronJobEntry so nothing of the framework's schema crosses. Titling
   * degrades gracefully without it.
   */
  loadAgentCronJobs?: () => Map<string, import("@/lib/sessions/session-title").CronJobEntry>;
  /**
   * Seed this module's rows from the bundled data/seed pack and write them
   * through to its files. Core owns the ORCHESTRATION (order, the once-only
   * meta flag, the recorded state) and its own catalogs; a module owns its tables.
   */
  seedAgentCatalog?: (
    opts: import("@/modules/hermes/lib/seed-agent-catalog").AgentSeedOptions,
  ) => import("@/modules/hermes/lib/seed-agent-catalog").AgentSeedResult;
  /** Write an already-seeded CORE skill through to the module. The skills table stays core. */
  publishSkill?: (skillKey: string) => void;
  /**
   * "How many skills may this agent use", built once per batch because the
   * tree walk is shared and only the denylist differs: the catalogue plus the
   * agent's own tree minus its config's denylist, both the module's file
   * layout. See src/lib/agents/agent-skills-count.ts.
   */
  createAgentSkillsCounter?: () => (slug: string) => number;
  /**
   * Boot sweep for rows a previous process left mid-flight, beside core's
   * reconcileRunsOnBoot in the same best-effort try/catch. Stories first
   * (T-0087): a row born "generating" inside a long LLM call has no owner after a restart.
   */
  reconcileOnBoot?: () => void;
}

export const SERVER_MODULES: readonly ServerModule[] = [recRoomServerModule, hermesServerModule];
