// ═══════════════════════════════════════════════════════════════
// runtime/index.ts — Agent runtime adapter (public surface)
//
// The single seam between PatterStage orchestration and the executing agent
// backend. Today that backend is Hermes (HermesRuntime over the API Server);
// swapping in another framework means implementing AgentRuntime and changing
// the `runtime` binding below — nothing in the orchestration layer changes.
// ═══════════════════════════════════════════════════════════════

export * from "./types";

import { HermesRuntime } from "./HermesRuntime";
import type { AgentRuntime } from "./types";

/** The active agent runtime backend (single source of truth for dispatch). */
export const runtime: AgentRuntime = new HermesRuntime();
