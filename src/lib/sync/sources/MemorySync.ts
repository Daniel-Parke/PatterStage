// ═══════════════════════════════════════════════════════════════
// sync/sources/MemorySync.ts — Sync Hindsight memory stats
//
// Calls the Hindsight HTTP server (localhost:9177) to get memory
// statistics and writes them to the meta table. Replaces the
// Python subprocess bridge pattern with direct fetch() calls.
// ═══════════════════════════════════════════════════════════════

import { existsSync, statSync } from "fs";
import { getAgentWorkspace } from "@/lib/runtime/workspace";
import { readHolographicFactCount } from "@/lib/runtime/memory-db";
import { setMultipleStats } from "@/lib/system-repository";
import { getMemoryProviderType, getActiveMemoryProvider } from "@/lib/memory/memory-providers";
import { logApiError } from "@/lib/api-logger";
import type { SyncSource, SyncResult } from "@/lib/sync/types";

/** Get memory database file size. */
function getMemoryDbSize(): string {
  try {
    const dbPath = getAgentWorkspace().memoryDb;
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
        factCount = readHolographicFactCount();
        dbSize = getMemoryDbSize();
      } else {
        // hindsight OR none: probe the active provider (DB-owned endpoint)
        // directly so a blank config.yaml `memory.provider` doesn't hide a live
        // install, and so a custom host/port set in /config/memory is honoured.
        const hs = await getActiveMemoryProvider().stats();
        if (hs.available) {
          provider = "Hindsight";
          dbSize = hs.dbSize ?? "In-agent";
          factCount = hs.factCount;
        }
      }

      // Write to meta table
      setMultipleStats({
        "memory.fact_count": String(factCount),
        "memory.db_size": dbSize,
        "memory.provider": provider,
      });
      // `memory.available` was written here on every tick and read by nobody.
      // It is also derivable from `memory.provider`, which IS read: "Not
      // Installed" is exactly the unavailable case (T-0081).

      return {
        sourceName: this.name,
        success: true,
        syncedCount: 3,
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
