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

/** Get fact count from Hindsight server via direct HTTP call. */
async function fetchHindsightFactCount(): Promise<number> {
  try {
    const res = await fetch(
      `${HINDSIGHT_BASE_URL}/${DEFAULT_BANK}/memories/list?limit=1`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return 0;
    const data = (await res.json()) as { total?: number };
    return data.total ?? 0;
  } catch {
    return 0;
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
      let provider = providerType === "none" ? "Not Installed" : providerType;

      if (providerType === "holographic") {
        factCount = getHolographicFactCount();
        dbSize = getMemoryDbSize();
      } else if (providerType === "hindsight") {
        provider = "Hindsight (embedded)";
        dbSize = "In-agent";
        factCount = await fetchHindsightFactCount();
      }

      // Write to meta table
      setMultipleStats({
        "memory.fact_count": String(factCount),
        "memory.db_size": dbSize,
        "memory.provider": provider,
      });
      setSystemStatBoolean("memory.available", factCount > 0);

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
