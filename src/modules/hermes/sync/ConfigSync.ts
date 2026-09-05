// ═══════════════════════════════════════════════════════════════
// sync/sources/ConfigSync.ts — Sync config.yaml → meta table
//
// Reads Hermes config.yaml and writes to the meta table what an API route
// actually reads from SQLite instead of walking the filesystem: whether the
// config and SOUL files are present, and any parse error.
//
// It used to claim it extracted "memory provider, default model, skills count".
// It never wrote a skills count at all, and the other two were written on every
// tick and read by nobody -- work done for no reader, under a comment that sent
// the next person looking for a writer that was never there (T-0081).
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
import { getActiveHermesPaths } from "../lib/agent-runtime";
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
          "config.soul_present": soulPresent,
          "config.yaml_error": "",
        });
        return {
          sourceName: this.name,
          success: true,
          syncedCount: 2,
          durationMs: Math.round(performance.now() - start),
        };
      }

      const raw = await readFile(configPath, "utf-8");

      // yaml.load can throw on duplicate keys (PR #135 fix). Treat that
      // as a non-fatal sync result — the API route layer has its own
      // try/catch around yaml.load and will surface the actual error.
      // We don't want to spam the sync error channel for a config that's
      // known to be temporarily broken.
      //
      // The PARSE is the point, not the result. Nothing here reads the parsed
      // document any more: the two values that used to be pulled out of it went
      // with the keys nobody read (T-0081). What survives is the answer to "does
      // this file parse", which `config.yaml_error` carries to the dashboard.
      try {
        yaml.load(raw);
      } catch (yamlErr) {
        // First line only, and for everything downstream: a YAMLException
        // carries a code-frame of the file around the fault, and a real
        // config.yaml holds api_key lines. This string is logged AND stored as
        // config.yaml_error, which the monitor route carries to the dashboard
        // (T-0086, the same hygiene ruling as T-0060's PUT refusal).
        const message = (yamlErr instanceof Error ? yamlErr.message : String(yamlErr))
          .split(String.fromCharCode(10))[0]
          .trim();
        // Log once per distinct error (no per-tick spam).
        if (message !== lastYamlErrorSignature) {
          logApiError("ConfigSync", "yaml.load failed (non-fatal — config is malformed)", message);
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

      // The memory-provider and default-model extraction that used to live here
      // went with the keys it fed. Both are still available where they are
      // actually read: the active memory provider comes from the DB via
      // getActiveMemoryConfig (migration 022 made PatterStage the owner of that
      // answer, T-0077), and the default model is read live by
      // useGatewayHealth off /api/config. Re-parsing config.yaml on every tick
      // to store a second copy nobody consulted was the whole defect.

      // Soul present
      const soulPresent = (await fileExists(H.soul)) ? "true" : "false";

      setMultipleStats({
        "config.present": "true",
        "config.soul_present": soulPresent,
        "config.yaml_error": "",
      });

      return {
        sourceName: this.name,
        success: true,
        syncedCount: 2,
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
