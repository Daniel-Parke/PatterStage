// ═══════════════════════════════════════════════════════════════
// modules/server.ts — the composition root for server-side module capability
//
// `registry.ts` is pure data: nav, routes, flags, no React and no database, so
// the e2e route matrix can import it from plain node. That purity means it
// cannot carry FUNCTIONS, and some module capability has to be callable by core:
// clearing a module's dev data, probing its health, listing its job kinds.
//
// This file is the one place allowed to import module code. Core calls the
// capability through the interface below and never names a module, which keeps
// the `core-imports-no-module` rule enforceable everywhere else. It is the same
// shape PatterStack uses (`build_server(extra_tools=discover_product_tools())`):
// a composition root that both sides depend on, rather than a dependency from
// core to a product.
//
// Adding a module means adding one entry here, not editing whatever core code
// happened to need it.
// ═══════════════════════════════════════════════════════════════

import { recRoomServerModule } from "@/modules/rec-room/server";
import { hermesServerModule } from "@/modules/hermes/server";

/** A dev-data record a module owns, for the "clean dev data" tool. */
export interface DevDataRecord {
  id: string;
  /** Shown to the operator, and what core matches its test-name pattern against. */
  label: string;
}

/**
 * The side-effectful half of a ProductModule. Everything is optional: a module
 * that owns no data implements none of it.
 */
export interface ServerModule {
  /** Must match the `id` of the same module in registry.ts. */
  id: string;
  /** Records this module would delete if the operator cleans dev data. */
  listDevData?: () => DevDataRecord[];
  /** Delete one of its own records by id. */
  deleteDevData?: (id: string) => void;
  /**
   * Agents this module can dispatch work to, as {slug, displayName}.
   *
   * Two fields, not the module row. agent_profiles belongs to the hermes module
   * (ADR-0005 rule 2) and its 17 columns are mostly a vendor file cache; core
   * only ever needs to know WHICH agents exist so it can resolve what the
   * operator typed. See src/lib/agents/roster.ts.
   */
  listAgentRoster?: () => import("@/lib/agents/roster").AgentRosterEntry[];
  /**
   * Read-side sync sources this module contributes to the SyncScheduler.
   *
   * Core owns the SyncSource contract and the scheduler; a module owns the
   * sources that read ITS store. ConfigSync parses a Hermes config.yaml schema
   * and probes SOUL.md, so it is the module's, not core's. The four sources that
   * only needed FILE PATHS stayed in core, because AgentWorkspace already
   * covers those neutrally.
   */
  syncSources?: () => import("@/lib/sync/types").SyncSource[];
  /**
   * The agent's recurring-job records, keyed by job id, for session titling.
   *
   * Returns a core-owned type (CronJobEntry: id + optional name), so nothing of
   * the framework's own schema crosses. Session titling degrades gracefully
   * without it, which is why it is optional in every sense.
   */
  loadAgentCronJobs?: () => Map<string, import("@/lib/sessions/session-title").CronJobEntry>;
  /**
   * Seed this module's own rows from the bundled data/seed pack, and write them
   * through to wherever the module keeps its files.
   *
   * Core owns the seed ORCHESTRATION (what runs, in what order, the once-only
   * meta flag, the recorded state) and its own catalogs. A module owns the half
   * that touches its tables.
   */
  seedAgentCatalog?: (
    opts: import("@/modules/hermes/lib/seed-agent-catalog").AgentSeedOptions,
  ) => import("@/modules/hermes/lib/seed-agent-catalog").AgentSeedResult;
  /**
   * Write an already-seeded CORE skill through to the module, so the agentic
   * path can execute it. The skills table stays core; only the publish is the
   * module's.
   */
  publishSkill?: (skillKey: string) => void;
  /**
   * Boot sweep for rows a previous process left mid-flight. Runs once at
   * scheduler boot beside core's reconcileRunsOnBoot, inside the same
   * best-effort try/catch. Stories are the first (T-0087): a row born
   * "generating" inside a minutes-long LLM call has no owner after a restart.
   */
  reconcileOnBoot?: () => void;
}

export const SERVER_MODULES: readonly ServerModule[] = [recRoomServerModule, hermesServerModule];
