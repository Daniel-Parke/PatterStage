// ═══════════════════════════════════════════════════════════════
// memory-providers/unavailable-provider.ts — active, but nothing here can serve it
//
// The registry used to return a Hindsight client for EVERY provider type,
// because its `default:` branch was a hindsight alias. That made a provider
// switch structurally unobservable, and a type nobody had implemented yet would
// quietly talk to Hindsight's endpoint while claiming to be itself (T-0077).
//
// This is what the registry returns instead. It reports the type the DATABASE
// says is active — not "none" — because that is the truth: the operator did
// select holographic, and what is missing is a client, not a selection. Callers
// asking "which provider is active" get the right answer; callers trying to USE
// it get a refusal that names the type rather than a silent connection to
// somebody else's backend.
// ═══════════════════════════════════════════════════════════════

import type {
  MemoryHealth,
  MemoryProvider,
  MemoryProviderType,
  MemoryStats,
} from "./types";

export class UnavailableMemoryProvider implements MemoryProvider {
  readonly type: MemoryProviderType;
  readonly baseUrl = "";

  constructor(type: MemoryProviderType = "none") {
    this.type = type;
  }

  private reason(): string {
    return this.type === "none"
      ? "No memory provider is configured."
      : `PatterStage has no client for the '${this.type}' memory provider.`;
  }

  bankBase(): string {
    return "";
  }

  async request<T = Record<string, unknown>>(): Promise<T> {
    throw new Error(`${this.reason()} There is nothing to query.`);
  }

  async health(): Promise<MemoryHealth> {
    return { available: false, error: this.reason() };
  }

  async stats(): Promise<MemoryStats> {
    return { available: false, factCount: 0 };
  }
}
