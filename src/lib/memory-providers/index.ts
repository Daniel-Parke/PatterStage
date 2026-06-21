// ═══════════════════════════════════════════════════════════════
// Memory Provider Factory — Detect and route to active provider
// ═══════════════════════════════════════════════════════════════
//
// Reads ~/.hermes/config.yaml to determine which memory provider
// is active, then delegates to the appropriate implementation.
//
// Supported providers:
//   - hindsight: PatterStage `/api/memory/hindsight` makes direct HTTP calls to the Hindsight HTTP server (port 9177)
//   - none: Graceful degradation when no provider configured

import { readFileSync, existsSync } from "fs";
import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";

// ── Shared Types (inlined from former ./types.ts) ─────────────────

/** Supported memory provider types */
export type MemoryProviderType = "holographic" | "hindsight" | "none";

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

// ── Provider Factory ───────────────────────────────────────────────

/** Parse the memory provider from config.yaml */
function getConfiguredProvider(): MemoryProviderType {
  try {
    const configPath = getActiveHermesPaths().config;
    if (!existsSync(configPath)) return "none";

    const content = readFileSync(configPath, "utf-8");
    const lines = content.split("\n");
    let inMemory = false;

    for (const line of lines) {
      if (line.trim().startsWith("memory:")) {
        inMemory = true;
        continue;
      }
      if (inMemory && !line.startsWith(" ") && line.trim()) break;
      if (inMemory && line.includes("provider:")) {
        const val = line.split("provider:")[1].trim().replace(/['"]/g, "");
        if (val === "holographic") return "holographic";
        if (val === "hindsight") return "hindsight";
        return "none";
      }
    }
    return "none";
  } catch {
    return "none";
  }
}

/** Get the configured provider type without instantiating */
export function getMemoryProviderType(): MemoryProviderType {
  return getConfiguredProvider();
}
