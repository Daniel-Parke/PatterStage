// ═══════════════════════════════════════════════════════════════
// memory-providers/registry.ts — resolve the active MemoryProvider
//
// The single place that turns the DB-owned config into a live provider. Add a
// new backend (Mem0/Zep/PS-native) by implementing MemoryProvider + a case here.
// ═══════════════════════════════════════════════════════════════

import { getActiveMemoryConfig } from "./repository";
import { HindsightMemoryProvider } from "./hindsight-provider";
import type { MemoryProvider } from "./types";

/** Build the active memory provider from the DB-owned config. */
export function getActiveMemoryProvider(): MemoryProvider {
  const { type, config } = getActiveMemoryConfig();
  switch (type) {
    // case "mem0": return new Mem0MemoryProvider(config);   // future
    // case "zep":  return new ZepMemoryProvider(config);    // future
    case "hindsight":
    default:
      return new HindsightMemoryProvider(config);
  }
}
