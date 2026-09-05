// ═══════════════════════════════════════════════════════════════
// memory-providers/types.ts — the pluggable MemoryProvider contract
//
// Mirrors the AgentRuntime seam: a provider is configured by a DB-owned
// MemoryProviderConfig (host/port/bank/…), so PatterStage manages the endpoint
// explicitly — Hindsight is the first impl; Mem0/Zep/a PS-native store can be
// added later by implementing this interface + registering in the registry.
// ═══════════════════════════════════════════════════════════════

export type MemoryProviderType = "hindsight" | "holographic" | "none";

/** DB-owned, provider-specific connection config (the `config_json` column). */
export interface MemoryProviderConfig {
  host: string;
  port: number;
  bank: string;
  [key: string]: unknown;
}

export interface MemoryHealth {
  available: boolean;
  status?: string;
  error?: string;
}

export interface MemoryStats {
  available: boolean;
  factCount: number;
  dbSize?: string;
}

export interface MemoryRequestOptions {
  method?: string;
  body?: Record<string, unknown>;
  timeoutMs?: number;
}

/**
 * A memory backend PatterStage can talk to. `request()` is the raw HTTP
 * passthrough used by provider-specific endpoints (directives, mental-models);
 * `health()`/`stats()` power the dashboard tile + the /config/memory UI.
 */
export interface MemoryProvider {
  readonly type: MemoryProviderType;
  /** Base URL, e.g. http://127.0.0.1:9177 */
  readonly baseUrl: string;
  /** Bank-scoped path prefix, e.g. /v1/default/banks/hermes */
  bankBase(): string;
  request<T = Record<string, unknown>>(path: string, opts?: MemoryRequestOptions): Promise<T>;
  health(): Promise<MemoryHealth>;
  stats(): Promise<MemoryStats>;
}
