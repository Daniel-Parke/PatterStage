// ═══════════════════════════════════════════════════════════════
// frameworks/registry.ts — resolve the active FrameworkAdapter
//
// Reads the DB-owned active framework + config and returns the matching
// adapter. Add a `case` here (+ a new adapter) to support a second framework.
// ═══════════════════════════════════════════════════════════════

import { getActiveFrameworkConfig } from "./repository";
import { HermesAdapter } from "@/modules/hermes/lib/framework-adapter";
import type { FrameworkAdapter } from "./types";

/** The active agent-framework adapter (defaults to Hermes). */
export function getActiveFramework(): FrameworkAdapter {
  const { type, config } = getActiveFrameworkConfig();
  switch (type) {
    case "hermes":
    default:
      return new HermesAdapter(config);
  }
}
