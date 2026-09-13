// ═══════════════════════════════════════════════════════════════
// Memory Provider Factory — the active provider, and how to reach it
// ═══════════════════════════════════════════════════════════════
//
// The DATABASE says which provider is active. It used to be this module that
// said so, by hand-scanning the agent's config.yaml for a `memory.provider:`
// line, while the Memory page wrote a `memory_providers` row: two switches,
// two truths, and a blank or malformed file reporting "none" over a live store
// with thousands of facts (T-0101, D64). The file is now written to agree
// rather than consulted to disagree; PUT /api/memory/config does that.
//
// Supported providers:
//   - hindsight: PatterStage `/api/memory/hindsight` makes direct HTTP calls to the Hindsight HTTP server (port 9177)
//   - none: Graceful degradation when no provider configured

// The pluggable provider interface + DB-owned config + active-provider resolver.
import type { MemoryProviderType } from "./types";
import { getActiveMemoryConfig } from "./repository";
export type { MemoryProviderType } from "./types";
export { getActiveMemoryProvider } from "./registry";
export {
  getActiveMemoryConfig,
  listMemoryProviders,
  updateMemoryProvider,
} from "./repository";

/** A single memory fact from any provider */
interface MemoryFact {
  id: number;
  content: string;
  category: string;
  tags: string;
  trust: number;
  createdAt: string;
  updatedAt: string;
}

/** Memory bank info (Holographic-specific but generic enough) */
interface MemoryBank {
  bank_name: string;
  fact_count: number;
  updated_at: string;
}

/** Response from reading memory facts */
export interface MemoryReadResult {
  facts: MemoryFact[];
  total: number;
  dbSize: number;
  available: boolean;
  provider: MemoryProviderType;
  message?: string;
  entities?: number;
  banks?: MemoryBank[];
}

// ── Provider Factory ───────────────────────────────────

/**
 * The active provider's type, without instantiating it.
 *
 * One read, from `getActiveMemoryConfig`, which is the same resolver
 * `getActiveMemoryProvider` uses. An active row that is switched off answers
 * `none`; no row at all answers `hindsight`, the zero-config default the
 * operator ruled stays (T-0077) and the file scan used to report as `none`.
 */
export function getMemoryProviderType(): MemoryProviderType {
  return getActiveMemoryConfig().type;
}
