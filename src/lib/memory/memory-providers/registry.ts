// ═══════════════════════════════════════════════════════════════
// memory-providers/registry.ts — resolve the active MemoryProvider
//
// The single place that turns the DB-owned config into a live provider. Add a
// new backend (Mem0/Zep/PS-native) by implementing MemoryProvider + a case here.
// ═══════════════════════════════════════════════════════════════

import { getActiveMemoryConfig } from "./repository";
import { HindsightMemoryProvider } from "./hindsight-provider";
import { UnavailableMemoryProvider } from "./unavailable-provider";
import type { MemoryProvider } from "./types";

/**
 * Build the active memory provider from the DB-owned config.
 *
 * `default:` used to fall through to Hindsight, which made a provider switch
 * structurally unobservable: the DB row flipped, and the product carried on
 * talking to Hindsight's endpoint under the new name. Every type now needs an
 * explicit case, and anything without an implementation gets a provider that
 * fails honestly rather than one pointed at somebody else's backend (T-0077).
 */
export function getActiveMemoryProvider(): MemoryProvider {
  const { type, config } = getActiveMemoryConfig();
  switch (type) {
    // case "mem0": return new Mem0MemoryProvider(config);   // future
    // case "zep":  return new ZepMemoryProvider(config);    // future
    case "hindsight":
      return new HindsightMemoryProvider(config);
    case "holographic":
      // Holographic reports from the agent's own local store; PatterStage has
      // no HTTP client for it, and GET /api/memory answers it directly. The
      // stand-in still NAMES it holographic, because that is what is active --
      // what is missing is a client, not a selection. What it must never be is
      // a Hindsight client wearing holographic's name.
      return new UnavailableMemoryProvider("holographic");
    case "none":
      return new UnavailableMemoryProvider("none");
    default:
      return new UnavailableMemoryProvider("none");
  }
}
