// ═══════════════════════════════════════════════════════════════
// sync/sources/EnvSync.ts — Sync .env → gateway_platforms table
//
// Reads Hermes .env file, extracts gateway platform tokens,
// and writes enabled/disabled status to the gateway_platforms table.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from "fs";
import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { db } from "@/lib/db";
import { logApiError } from "@/lib/api-logger";
import type { SyncSource, SyncResult } from "@/lib/sync/types";

/** Parse .env content into a key-value map. */
function parseEnvVars(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const eqIdx = line.indexOf("=");
    if (eqIdx > 0 && !line.startsWith("#")) {
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      val = val.replace(/^["']|["']$/g, "");
      if (val && val !== "changeme") vars[key] = val;
    }
  }
  return vars;
}

/** Check if a platform has a valid token configured. */
function hasToken(vars: Record<string, string>, ...keys: string[]): boolean {
  return keys.some((k) => !!vars[k]);
}

export class EnvSync implements SyncSource {
  readonly name = "env";

  async sync(): Promise<SyncResult> {
    const start = performance.now();
    try {
      const envPath = getActiveHermesPaths().env;
      if (!existsSync(envPath)) {
        return {
          sourceName: this.name,
          success: true,
          syncedCount: 0,
          durationMs: Math.round(performance.now() - start),
        };
      }

      const content = readFileSync(envPath, "utf-8");
      const vars = parseEnvVars(content);

      const platforms: Array<{
        platform: string;
        enabled: number;
        bot_token_present: number;
      }> = [
        {
          platform: "telegram",
          enabled: hasToken(vars, "TELEGRAM_BOT_TOKEN") ? 1 : 0,
          bot_token_present: hasToken(vars, "TELEGRAM_BOT_TOKEN") ? 1 : 0,
        },
        {
          platform: "discord",
          enabled: hasToken(vars, "DISCORD_BOT_TOKEN") ? 1 : 0,
          bot_token_present: hasToken(vars, "DISCORD_BOT_TOKEN") ? 1 : 0,
        },
        {
          platform: "slack",
          enabled: hasToken(vars, "SLACK_BOT_TOKEN") ? 1 : 0,
          bot_token_present: hasToken(vars, "SLACK_BOT_TOKEN") ? 1 : 0,
        },
        {
          platform: "whatsapp",
          enabled:
            hasToken(vars, "WHATSAPP_API_KEY") ||
            hasToken(vars, "WHATSAPP_PHONE_ID")
              ? 1
              : 0,
          bot_token_present:
            hasToken(vars, "WHATSAPP_API_KEY") ||
            hasToken(vars, "WHATSAPP_PHONE_ID")
              ? 1
              : 0,
        },
      ];

      const now = new Date().toISOString();
      const database = db();
      const upsert = database.prepare(
        `INSERT OR REPLACE INTO gateway_platforms (platform, enabled, bot_token_present, last_synced_at)
         VALUES (?, ?, ?, ?)`
      );
      const tx = database.transaction(() => {
        for (const p of platforms) {
          upsert.run(p.platform, p.enabled, p.bot_token_present, now);
        }
      });
      tx();

      return {
        sourceName: this.name,
        success: true,
        syncedCount: platforms.length,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (err) {
      logApiError("EnvSync", "syncing env", err);
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
