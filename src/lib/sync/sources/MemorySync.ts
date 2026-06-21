// ═══════════════════════════════════════════════════════════════
// sync/sources/MemorySync.ts — Sync Hindsight memory stats
//
// Calls the Hindsight HTTP server (localhost:9177) to get memory
// statistics and writes them to the meta table. Replaces the
// Python subprocess bridge pattern with direct fetch() calls.
// ═══════════════════════════════════════════════════════════════

import { existsSync, statSync } from "fs";
import Database from "better-sqlite3";
import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { setMultipleStats, setSystemStatBoolean } from "@/lib/system-repository";
import { getMemoryProviderType } from "@/lib/memory-providers";
import { logApiError } from "@/lib/api-logger";
import type { SyncSource, SyncResult } from "@/lib/sync/types";

const HINDSIGHT_BASE_URL = "http://localhost:9177/v1/default/banks";
const DEFAULT_BANK = "hermes";

/**
 * Probe the running Hindsight server. `available` means the server answered
 * (so it IS installed/running, even with 0 facts) — we do NOT rely on the
 * Hermes config.yaml `memory.provider` value, which is frequently blank while
 * Hindsight is configured in its own ~/.hermes/hindsight/config.json. This is
 * the dashboard-tile honesty fix (Phase 1 replaces this with the provider
 * registry + DB-owned config).
 */
async function fetchHindsightStats(): Promise<{ available: boolean; total: number }> {
  try {
    const res = await fetch(
      `${HINDSIGHT_BASE_URL}/${DEFAULT_BANK}/memories/list?limit=1`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return { available: false, total: 0 };
    const data = (await res.json()) as { total?: number };
    return { available: true, total: data.total ?? 0 };
  } catch {
    return { available: false, total: 0 };
  }
}

/** Get fact count from local SQLite (holographic provider). */
function getHolographicFactCount(): number {
  try {
    const dbPath = getActiveHermesPaths().memoryDb;
    if (!existsSync(dbPath)) return 0;

    const memDb = new Database(dbPath, { readonly: true });
    try {
      const row = memDb
        .prepare("SELECT COUNT(*) as count FROM facts")
        .get() as { count: number };
      return row.count;
    } finally {
      memDb.close();
    }
  } catch {
    return 0;
  }
}

/** Get memory database file size. */
function getMemoryDbSize(): string {
  try {
    const dbPath = getActiveHermesPaths().memoryDb;
    if (!existsSync(dbPath)) return "N/A";
    const stats = statSync(dbPath);
    const sizeKB = Math.round(stats.size / 1024);
    return sizeKB > 1024
      ? (sizeKB / 1024).toFixed(1) + " MB"
      : sizeKB + " KB";
  } catch {
    return "N/A";
  }
}

export class MemorySync implements SyncSource {
  readonly name = "memory";

  async sync(): Promise<SyncResult> {
    const start = performance.now();
    try {
      const providerType = getMemoryProviderType();

      let factCount = 0;
      let dbSize = "N/A";
      let provider = "Not Installed";

      if (providerType === "holographic") {
        provider = "Holographic";
        factCount = getHolographicFactCount();
        dbSize = getMemoryDbSize();
      } else {
        // hindsight OR none: probe the running Hindsight server directly so a
        // blank config.yaml `memory.provider` doesn't hide a live install.
        const hs = await fetchHindsightStats();
        if (hs.available) {
          provider = "Hindsight";
          dbSize = "In-agent";
          factCount = hs.total;
        }
      }

      // Write to meta table
      setMultipleStats({
        "memory.fact_count": String(factCount),
        "memory.db_size": dbSize,
        "memory.provider": provider,
      });
      setSystemStatBoolean("memory.available", provider !== "Not Installed");

      return {
        sourceName: this.name,
        success: true,
        syncedCount: 4,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (err) {
      logApiError("MemorySync", "syncing memory stats", err);
      return {
        sourceName: this.name,
        success: false,
        syncedCount: 0,
        error: String(err),
        durationMs: Math.round(performance.now() - start),
      };
    }
  }
}
