// ═══════════════════════════════════════════════════════════════
// Memory Provider Factory — Detect and route to active provider
// ═══════════════════════════════════════════════════════════════
//
// Reads ~/.hermes/config.yaml to determine which memory provider
// is active, then delegates to the appropriate implementation.
//
// Supported providers:
//   - holographic: SQLite direct access (memory_store.db)
//   - hindsight: Control Hub `/api/memory/hindsight` makes direct HTTP calls to the Hindsight HTTP server (port 9177)
//   - none: Graceful degradation when no provider configured

import { readFileSync, existsSync } from "fs";
import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { holographicProvider } from "./holographic";

// ── Shared Types (inlined from former ./types.ts) ─────────────────

/** Supported memory provider types */
export type MemoryProviderType = "holographic" | "hindsight" | "none";

/** A single memory fact from any provider */
export interface MemoryFact {
  id: number;
  content: string;
  category: string;
  tags: string;
  trust: number;
  createdAt: string;
  updatedAt: string;
}

/** Memory bank info (Holographic-specific but generic enough) */
export interface MemoryBank {
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

/** Response from adding a fact */
export interface MemoryAddResult {
  success: boolean;
  fact?: MemoryFact;
  error?: string;
}

/** Response from updating a fact */
export interface MemoryUpdateResult {
  success: boolean;
  id?: number;
  error?: string;
}

/** Response from deleting a fact */
export interface MemoryDeleteResult {
  success: boolean;
  id?: number;
  error?: string;
}

/** Provider health status */
export interface MemoryProviderHealth {
  available: boolean;
  provider: MemoryProviderType;
  message: string;
  factCount?: number;
  dbSize?: number;
}

/** Fact input for adding */
export interface FactInput {
  content: string;
  category?: string;
  tags?: string;
  trust_score?: number;
}

/** Fact input for updating */
export interface FactUpdateInput {
  id: number;
  content?: string;
  category?: string;
  tags?: string;
  trust_score?: number;
}

/** Memory provider interface — all providers must implement this */
export interface MemoryProvider {
  /** Provider type identifier */
  readonly type: MemoryProviderType;

  /** Check if this provider is available and healthy */
  healthCheck(): Promise<MemoryProviderHealth>;

  /** Read facts with optional search/filter */
  readFacts(options?: {
    search?: string;
    category?: string;
    limit?: number;
  }): Promise<MemoryReadResult>;

  /** Add a new fact */
  addFact(input: FactInput): Promise<MemoryAddResult>;

  /** Update an existing fact */
  updateFact(input: FactUpdateInput): Promise<MemoryUpdateResult>;

  /** Delete a fact by ID */
  deleteFact(id: number): Promise<MemoryDeleteResult>;
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

/** Null provider for when no memory system is configured */
const nullProvider: MemoryProvider = {
  type: "none",
  async healthCheck() {
    return {
      available: false,
      provider: "none",
      message: "No memory provider configured. Run hermes memory setup to configure one.",
    };
  },
  async readFacts() {
    return {
      facts: [],
      total: 0,
      dbSize: 0,
      available: false,
      provider: "none",
      message: "No memory provider configured.",
    };
  },
  async addFact() {
    return { success: false, error: "No memory provider configured" };
  },
  async updateFact() {
    return { success: false, error: "No memory provider configured" };
  },
  async deleteFact() {
    return { success: false, error: "No memory provider configured" };
  },
};

/** Get the active memory provider based on config */
export function getMemoryProvider(): MemoryProvider {
  const configured = getConfiguredProvider();
  switch (configured) {
    case "holographic":
      return holographicProvider;
    default:
      // hindsight, none, or any other — no direct provider
      // Dashboard shows status only, facts managed via agent tools
      return nullProvider;
  }
}

/** Get the configured provider type without instantiating */
export function getMemoryProviderType(): MemoryProviderType {
  return getConfiguredProvider();
}

/** Check if holographic DB exists on disk */
export function hasHolographicDb(): boolean {
  const dbPath = getActiveHermesPaths().memoryDb;
  return existsSync(dbPath);
}
