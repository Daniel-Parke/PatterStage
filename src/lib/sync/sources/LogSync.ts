// ═══════════════════════════════════════════════════════════════
// sync/sources/LogSync.ts — Sync gateway.log + errors.log
//
// Reads the last N error lines from Hermes log files and upserts
// them into the error_log_entries table. Deduplicates by content
// + timestamp so repeated syncs don't bloat the table.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from "fs";
import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { db, now } from "@/lib/db";
import { logApiError } from "@/lib/api-logger";
import type { SyncSource, SyncResult } from "@/lib/sync/types";

/** Extract timestamp from a log line. Returns empty string if no match. */
function extractTimestamp(line: string): string {
  const match = line.match(
    /(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/
  );
  return match ? match[1] : "";
}

/** Determine severity from a log line. */
function detectSeverity(line: string): string {
  if (line.includes(" CRITICAL ")) return "critical";
  if (line.includes(" ERROR ")) return "error";
  if (line.includes(" WARNING ") || line.includes(" WARN ")) return "warning";
  return "error";
}

/** Read error lines from a log file. Returns up to `maxLines` entries. */
function readErrorLines(
  filePath: string,
  source: string,
  maxLines: number
): Array<{ source: string; message: string; timestamp: string; severity: string }> {
  if (!existsSync(filePath)) return [];

  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const errorLines = lines.filter(
      (l) =>
        l.includes(" ERROR ") ||
        l.includes(" CRITICAL ") ||
        l.includes("failed") ||
        l.includes("Error:")
    );
    return errorLines.slice(-maxLines).map((line) => ({
      source,
      message: line.trim(),
      timestamp: extractTimestamp(line),
      severity: detectSeverity(line),
    }));
  } catch {
    return [];
  }
}

export class LogSync implements SyncSource {
  readonly name = "logs";
  private maxEntriesPerSource = 50;

  async sync(): Promise<SyncResult> {
    const start = performance.now();
    try {
      const H = getActiveHermesPaths();
      const logDir = H.logs;

      // Read from both gateway.log and errors.log
      const gatewayErrors = readErrorLines(
        logDir + "/gateway.log",
        "gateway",
        this.maxEntriesPerSource
      );
      const agentErrors = readErrorLines(
        logDir + "/errors.log",
        "agent",
        this.maxEntriesPerSource
      );

      const allEntries = [...gatewayErrors, ...agentErrors];

      if (allEntries.length === 0) {
        return {
          sourceName: this.name,
          success: true,
          syncedCount: 0,
          durationMs: Math.round(performance.now() - start),
        };
      }

      // Deduplicate: use (source + timestamp + first 80 chars of message) as dedup key
      const seen = new Set<string>();
      const uniqueEntries = allEntries.filter((e) => {
        const key = `${e.source}|${e.timestamp}|${e.message.slice(0, 80)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const ingestedAt = now();
      const database = db();
      const insert = database.prepare(
        `INSERT INTO error_log_entries (source, message, timestamp, severity, ingested_at)
         VALUES (?, ?, ?, ?, ?)`
      );

      const tx = database.transaction(() => {
        for (const entry of uniqueEntries) {
          insert.run(entry.source, entry.message, entry.timestamp, entry.severity, ingestedAt);
        }
      });
      tx();

      // Prune old entries — keep only the most recent 500
      database
        .prepare(
          `DELETE FROM error_log_entries WHERE id NOT IN (
            SELECT id FROM error_log_entries ORDER BY timestamp DESC LIMIT 500
          )`
        )
        .run();

      return {
        sourceName: this.name,
        success: true,
        syncedCount: uniqueEntries.length,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (err) {
      logApiError("LogSync", "syncing error logs", err);
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
