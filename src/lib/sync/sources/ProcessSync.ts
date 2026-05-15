// ═══════════════════════════════════════════════════════════════
// sync/sources/ProcessSync.ts — Sync ps aux → agent_processes table
//
// Runs `ps aux` asynchronously to discover running Hermes processes
// (gateway, cron jobs, subagents) and writes them to the
// agent_processes table. Replaces the execSync-based /api/agents route.
// ═══════════════════════════════════════════════════════════════

import { exec } from "child_process";
import { existsSync, readFileSync } from "fs";
import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { db, now } from "@/lib/db";
import { logApiError } from "@/lib/api-logger";
import type { SyncSource, SyncResult } from "@/lib/sync/types";

interface ParsedProcess {
  id: string;
  type: string;
  name: string;
  status: string;
  pid: number | null;
  model: string;
  turns: number;
  lastActivity: string;
}

/** Run `ps aux` and return parsed lines. */
function runPs(): Promise<string[]> {
  return new Promise((resolve) => {
    exec("ps aux", { timeout: 5000 }, (err, stdout) => {
      if (err && !stdout) {
        resolve([]);
        return;
      }
      const lines = stdout
        .split("\n")
        .slice(1) // skip header
        .filter((l) => l.trim());
      resolve(lines);
    });
  });
}

/** Parse a ps aux line into pid + command. */
function parsePsLine(
  line: string
): { pid: number; cmd: string; startTime: string } | null {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 11) return null;
  const pid = parseInt(parts[1], 10);
  if (isNaN(pid)) return null;
  return {
    pid,
    cmd: parts.slice(10).join(" "),
    startTime: parts[8],
  };
}

const EXCLUDED_CMDS = ["bash", "printf", "grep"];

export class ProcessSync implements SyncSource {
  readonly name = "processes";

  async sync(): Promise<SyncResult> {
    const start = performance.now();
    try {
      const processes: ParsedProcess[] = [];

      // ── Gateway processes ─────────────────────────────────
      const psLines = await runPs();
      const gatewayLines = psLines.filter(
        (l) => l.includes("gateway run") && !EXCLUDED_CMDS.some((c) => l.includes(c))
      );

      const seenPids = new Set<number>();
      for (const line of gatewayLines) {
        const parsed = parsePsLine(line);
        if (!parsed || seenPids.has(parsed.pid)) continue;
        seenPids.add(parsed.pid);

        // Check .env for platform labels
        let platformLabel = "Gateway";
        try {
          const H = getActiveHermesPaths();
          const envPath = H.env;
          if (existsSync(envPath)) {
            const envContent = readFileSync(envPath, "utf-8");
            const platforms: string[] = [];
            if (
              envContent.includes("DISCORD_BOT_TOKEN=") &&
              !envContent.match(/^#\s*DISCORD_BOT_TOKEN/m)
            )
              platforms.push("Discord");
            if (
              envContent.includes("TELEGRAM_BOT_TOKEN=") &&
              !envContent.match(/^#\s*TELEGRAM_BOT_TOKEN/m)
            )
              platforms.push("Telegram");
            if (
              envContent.includes("SLACK_BOT_TOKEN=") &&
              !envContent.match(/^#\s*SLACK_BOT_TOKEN/m)
            )
              platforms.push("Slack");
            if (platforms.length > 0)
              platformLabel = platforms.join(" + ");
          }
        } catch {
          // Best effort
        }

        processes.push({
          id: `gateway-${parsed.pid}`,
          type: "gateway",
          name: `Hermes Gateway (${platformLabel})`,
          status: "running",
          pid: parsed.pid,
          model: "gateway",
          turns: 0,
          lastActivity: new Date().toISOString(),
        });
      }

      // ── Subagents ─────────────────────────────────────────
      const subagentLines = psLines.filter(
        (l) =>
          (l.includes("run_agent") || l.includes("AIAgent") || l.includes("hermes") && l.includes("chat")) &&
          !l.includes("gateway run") &&
          !EXCLUDED_CMDS.some((c) => l.includes(c))
      );

      for (const line of subagentLines) {
        const parsed = parsePsLine(line);
        if (!parsed || seenPids.has(parsed.pid)) continue;
        seenPids.add(parsed.pid);
        processes.push({
          id: `subagent-${parsed.pid}`,
          type: "subagent",
          name: `Subagent (PID ${parsed.pid})`,
          status: "running",
          pid: parsed.pid,
          model: "unknown",
          turns: 0,
          lastActivity: new Date().toISOString(),
        });
      }

      // ── Write to DB ───────────────────────────────────────
      const database = db();
      const timestamp = now();

      // Clear stale entries first
      database.prepare("DELETE FROM agent_processes").run();

      if (processes.length > 0) {
        const insert = database.prepare(
          `INSERT INTO agent_processes (id, type, name, status, pid, model, turns, last_activity, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const tx = database.transaction(() => {
          for (const p of processes) {
            insert.run(
              p.id,
              p.type,
              p.name,
              p.status,
              p.pid,
              p.model,
              p.turns,
              p.lastActivity,
              timestamp
            );
          }
        });
        tx();
      }

      return {
        sourceName: this.name,
        success: true,
        syncedCount: processes.length,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (err) {
      logApiError("ProcessSync", "syncing processes", err);
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
