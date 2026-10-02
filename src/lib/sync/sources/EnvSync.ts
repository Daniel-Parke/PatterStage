// ═══════════════════════════════════════════════════════════════
// sync/sources/EnvSync.ts — Sync .env → gateway_platforms table
//
// Reads Hermes .env file, extracts gateway platform tokens,
// and writes enabled/disabled status to the gateway_platforms table.
// ═══════════════════════════════════════════════════════════════

import { access, constants } from "fs/promises";
import { readFile } from "fs/promises";
import { getAgentWorkspace } from "@/lib/runtime/workspace";
import { upsertGatewayPlatforms } from "@/lib/sync/sync-repository";
import { hasToken, readEnvTokenPresence } from "@/lib/sync/env-token-presence";
import { logApiError } from "@/lib/api/api-logger";
import type { SyncSource, SyncResult } from "@/lib/sync/types";
import { syncFailure, syncSuccess } from "@/lib/sync/types";

export class EnvSync implements SyncSource {
  readonly name = "env";

  async sync(): Promise<SyncResult> {
    const start = performance.now();
    try {
      const envPath = getAgentWorkspace().env;
      let envExists = false;
      try {
        await access(envPath, constants.F_OK);
        envExists = true;
      } catch {
        envExists = false;
      }
      if (!envExists) {
        return syncSuccess(this.name, 0, start);
      }

      const content = await readFile(envPath, "utf-8");
      const vars = readEnvTokenPresence(content);

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
      upsertGatewayPlatforms(platforms, now);

      return syncSuccess(this.name, platforms.length, start);
    } catch (err) {
      logApiError("EnvSync", "syncing env", err);
      return syncFailure(this.name, err, start);
    }
  }
}
