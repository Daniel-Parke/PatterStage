// ═══════════════════════════════════════════════════════════════
// sync/sources/ConfigSync.ts — Sync config.yaml → meta table
//
// Reads Hermes config.yaml, extracts key metadata (memory provider,
// default model, skills count), and writes it to the meta table
// so API routes can read from SQLite instead of the filesystem.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from "fs";
import yaml from "js-yaml";
import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { setMultipleStats } from "@/lib/system-repository";
import { logApiError } from "@/lib/api-logger";
import type { SyncSource, SyncResult } from "@/lib/sync/types";

export class ConfigSync implements SyncSource {
  readonly name = "config";

  async sync(): Promise<SyncResult> {
    const start = performance.now();
    try {
      const H = getActiveHermesPaths();
      const configPath = H.config;

      if (!existsSync(configPath)) {
        setMultipleStats({
          "config.present": "false",
          "config.memory_provider": "",
          "config.default_model": "",
          "config.soul_present": existsSync(H.soul) ? "true" : "false",
        });
        return {
          sourceName: this.name,
          success: true,
          syncedCount: 3,
          durationMs: Math.round(performance.now() - start),
        };
      }

      const raw = readFileSync(configPath, "utf-8");
      const cfg = yaml.load(raw) as Record<string, unknown>;

      // Memory provider
      const mem = cfg.memory;
      const memoryProvider =
        mem && typeof mem === "object"
          ? String((mem as Record<string, unknown>).provider ?? "")
          : "";

      // Default model (from 'model' key or fallback blocks)
      const defaultModel = typeof cfg.model === "string" ? cfg.model : "";

      // Soul present
      const soulPresent = existsSync(H.soul) ? "true" : "false";

      setMultipleStats({
        "config.present": "true",
        "config.memory_provider": memoryProvider,
        "config.default_model": defaultModel,
        "config.soul_present": soulPresent,
      });

      return {
        sourceName: this.name,
        success: true,
        syncedCount: 4,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (err) {
      logApiError("ConfigSync", "syncing config", err);
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
