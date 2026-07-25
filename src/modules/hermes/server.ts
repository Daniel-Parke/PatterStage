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

import { listProfiles } from "./lib/profiles-repository";

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
};
