// ═══════════════════════════════════════════════════════════════
// memory-providers/hindsight-provider.ts — Hindsight over HTTP
//
// Endpoint + bank come from the DB-owned config (not hardcoded localhost:9177).
// request() preserves the error-message shape the route's connection-error
// detector matches, so the 503 downgrade keeps working.
// ═══════════════════════════════════════════════════════════════

import type {
  MemoryHealth,
  MemoryProvider,
  MemoryProviderConfig,
  MemoryRequestOptions,
  MemoryStats,
} from "./types";

const DEFAULT_TIMEOUT_MS = 15_000;

export class HindsightMemoryProvider implements MemoryProvider {
  readonly type = "hindsight" as const;
  readonly baseUrl: string;
  private readonly bank: string;

  constructor(config: MemoryProviderConfig) {
    const host = String(config.host || "127.0.0.1");
    const port = Number(config.port || 9177);
    this.baseUrl = `http://${host}:${port}`;
    this.bank = String(config.bank || "hermes");
  }

  bankBase(): string {
    return `/v1/default/banks/${this.bank}`;
  }

  async request<T = Record<string, unknown>>(
    path: string,
    { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS }: MemoryRequestOptions = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const init: RequestInit = { method, signal: controller.signal };
    if (body) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }
    try {
      const res = await fetch(`${this.baseUrl}${path}`, init);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Hindsight ${method} ${path}: ${res.status} ${text}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async health(): Promise<MemoryHealth> {
    try {
      const r = await this.request<{ status?: string }>("/health", { timeoutMs: 3000 });
      return { available: true, status: r.status ?? "healthy" };
    } catch (e) {
      // Name the address. "fetch failed" on its own sent the operator to the
      // config page to find out what was tried (T-0091).
      const why = e instanceof Error ? e.message : "unreachable";
      return { available: false, error: `could not reach ${this.baseUrl}: ${why}` };
    }
  }

  async stats(): Promise<MemoryStats> {
    try {
      const r = await this.request<{ total?: number }>(`${this.bankBase()}/memories/list?limit=1`, {
        timeoutMs: 3000,
      });
      return { available: true, factCount: r.total ?? 0, dbSize: "In-agent" };
    } catch {
      return { available: false, factCount: 0 };
    }
  }
}
