// ═══════════════════════════════════════════════════════════════
// sync/sources/ConfigSync.ts — Sync config.yaml → meta table
//
// Reads Hermes config.yaml, extracts key metadata (memory provider,
// default model, skills count), and writes it to the meta table
// so API routes can read from SQLite instead of the filesystem.
//
// All filesystem I/O is async (fs.promises) so the event loop is
// not blocked while reading config.yaml. While config.yaml is
// normally small, a user-edited file with bloat could become
// multi-megabyte; the synchronous readFileSync was a latent
// event-loop block. See SyncScheduler for the per-source timeout.
// ═══════════════════════════════════════════════════════════════

import { access, constants } from "fs/promises";
import { readFile } from "fs/promises";
import yaml from "js-yaml";
import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { setMultipleStats } from "@/lib/system-repository";
import { logApiError } from "@/lib/api-logger";
import type { SyncSource, SyncResult } from "@/lib/sync/types";

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// The config.yaml parse error recurs on every 15s sync tick while the file
// stays malformed. Track the last-seen message so we log it ONCE per distinct
// error instead of ~4×/min forever (mirrors session-sync's orphan-log
// suppression). Reset when the config parses cleanly again.
let lastYamlErrorSignature: string | null = null;

export class ConfigSync implements SyncSource {
  readonly name = "config";

  async sync(): Promise<SyncResult> {
    const start = performance.now();
    try {
      const H = getActiveHermesPaths();
      const configPath = H.config;

      const configPresent = await fileExists(configPath);
      if (!configPresent) {
        const soulPresent = (await fileExists(H.soul)) ? "true" : "false";
        setMultipleStats({
          "config.present": "false",
          "config.memory_provider": "",
          "config.default_model": "",
          "config.soul_present": soulPresent,
          "config.yaml_error": "",
        });
        return {
          sourceName: this.name,
          success: true,
          syncedCount: 3,
          durationMs: Math.round(performance.now() - start),
        };
      }

      const raw = await readFile(configPath, "utf-8");

      // yaml.load can throw on duplicate keys (PR #135 fix). Treat that
      // as a non-fatal sync result — the API route layer has its own
      // try/catch around yaml.load and will surface the actual error.
      // We don't want to spam the sync error channel for a config that's
      // known to be temporarily broken.
      let cfg: Record<string, unknown> = {};
      try {
        cfg = yaml.load(raw) as Record<string, unknown>;
      } catch (yamlErr) {
        const message = yamlErr instanceof Error ? yamlErr.message : String(yamlErr);
        // Log once per distinct error (no per-tick spam).
        if (message !== lastYamlErrorSignature) {
          logApiError("ConfigSync", "yaml.load failed (non-fatal — config is malformed)", yamlErr);
          lastYamlErrorSignature = message;
        }
        // Surface the malformed-config state so the dashboard can show ONE
        // actionable alert (the file exists but cannot be parsed).
        setMultipleStats({
          "config.present": "true",
          "config.yaml_error": message,
        });
        return {
          sourceName: this.name,
          success: true,
          syncedCount: 0,
          durationMs: Math.round(performance.now() - start),
        };
      }
      // Parsed cleanly — clear any prior malformed-config alert + log gate.
      lastYamlErrorSignature = null;

      // Memory provider
      const mem = cfg.memory;
      const memoryProvider =
        mem && typeof mem === "object"
          ? String((mem as Record<string, unknown>).provider ?? "")
          : "";

      // Default model (model.default when model is an object, or string shorthand)
      let defaultModel = "";
      const modelCfg = cfg.model;
      if (typeof modelCfg === "string") {
        defaultModel = modelCfg;
      } else if (modelCfg && typeof modelCfg === "object" && !Array.isArray(modelCfg)) {
        const m = modelCfg as Record<string, unknown>;
        defaultModel = String(m.default ?? m.model ?? "");
      }

      // Soul present
      const soulPresent = (await fileExists(H.soul)) ? "true" : "false";

      setMultipleStats({
        "config.present": "true",
        "config.memory_provider": memoryProvider,
        "config.default_model": defaultModel,
        "config.soul_present": soulPresent,
        "config.yaml_error": "",
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
