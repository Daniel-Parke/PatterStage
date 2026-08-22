// ═══════════════════════════════════════════════════════════════
// sync/sources/LogSync.ts — Sync gateway.log + errors.log
//
// Reads the last N error lines from Hermes log files and upserts
// them into the error_log_entries table. Deduplicates by content
// + timestamp so repeated syncs don't bloat the table.
//
// Uses a streaming line reader (readline over fs.createReadStream)
// so the event loop is yielded between lines. This matters because
// gateway.log can grow to many MBs and the previous readFileSync
// implementation loaded the entire file into memory and blocked
// the event loop for the duration. We also keep only the last
// `tailBytes` bytes of the file to bound work — most error lines
// are recent anyway.
// ═══════════════════════════════════════════════════════════════

import { createReadStream, statSync } from "fs";
import { access, constants } from "fs/promises";
import { join } from "path";
import { createInterface } from "readline";
import { getAgentWorkspace } from "@/lib/runtime/workspace";
import { now } from "@/lib/db";
import { insertErrorLogEntries, pruneErrorLogEntries } from "@/lib/sync/sync-repository";
import { logApiError } from "@/lib/api-logger";
import type { SyncSource, SyncResult } from "@/lib/sync/types";

/** Extract timestamp from a log line. Returns empty string if no match. */
function extractTimestamp(line: string): string {
  const match = line.match(
    /(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/
  );
  return match ? match[1] : "";
}

/** Determine severity from a log line.
 *
 * The log LEVEL is a prefix field, so whichever level keyword appears FIRST in
 * the line wins — a "WARNING … (payment error)" line is a WARNING, not an
 * ERROR (the body text mentioning "error" must not upgrade it). The old version
 * tested ERROR before WARNING regardless of position, flooding the Errors panel
 * with red chips for transient provider WARNINGs. */
export function detectSeverity(line: string): string {
  const firstIndex = (re: RegExp): number => {
    const m = re.exec(line);
    return m ? m.index : Infinity;
  };
  const crit = firstIndex(/\bCRITICAL\b/i);
  const err = firstIndex(/\bERROR\b/i);
  const warn = firstIndex(/\bWARN(?:ING)?\b/i);
  const earliest = Math.min(crit, err, warn);
  if (earliest === Infinity) return "error"; // collected via "failed" with no explicit level
  if (earliest === crit) return "critical";
  if (earliest === warn) return "warning";
  return "error";
}

/** Read up to `maxLines` matching lines from the end of a log file using
 *  a streaming reader. If the file is larger than `tailBytes`, we read
 *  only the last `tailBytes` bytes (most recent content). This bounds
 *  memory and CPU on multi-megabyte log files. */
async function readMatchingLines(
  filePath: string,
  maxLines: number,
  tailBytes: number = 2 * 1024 * 1024, // 2 MB
): Promise<string[]> {
  // Fast bail on missing file (async so we don't block).
  try {
    await access(filePath, constants.F_OK);
  } catch {
    return [];
  }

  // Determine the start offset for the tail. statSync is sync but the
  // kernel caches stat results for hot files and this is a single call
  // returning a small struct — measured at sub-microsecond on warm
  // caches. The 2MB tail read is what dominates time.
  const size = statSync(filePath).size;
  const startOffset = size > tailBytes ? size - tailBytes : 0;

  return new Promise<string[]>((resolve) => {
    const stream = createReadStream(filePath, {
      encoding: "utf-8",
      start: startOffset,
    });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    // We keep a sliding window of the last `maxLines` matching lines.
    // A circular buffer is more memory-efficient than retaining the
    // entire line array for large files.
    const buffer: string[] = [];
    const isErrorLine = (l: string): boolean =>
      /\bERROR\b/i.test(l) ||
      /\bCRITICAL\b/i.test(l) ||
      /\bfailed\b/i.test(l);

    rl.on("line", (line) => {
      if (!isErrorLine(line)) return;
      buffer.push(line);
      if (buffer.length > maxLines) buffer.shift();
    });
    rl.on("close", () => resolve(buffer));
    rl.on("error", () => resolve(buffer));
  });
}

export class LogSync implements SyncSource {
  readonly name = "logs";
  private maxEntriesPerSource = 50;

  async sync(): Promise<SyncResult> {
    const start = performance.now();
    try {
      const H = getAgentWorkspace();
      const logDir = H.logs;

      // Read from both gateway.log and errors.log in parallel — each
      // yields to the event loop while reading.
      const [gatewayErrors, agentErrors] = await Promise.all([
        readMatchingLines(join(logDir, "gateway.log"), this.maxEntriesPerSource),
        readMatchingLines(join(logDir, "errors.log"), this.maxEntriesPerSource),
      ]);

      const gatewayEntries = gatewayErrors.map((message) => ({
        source: "gateway",
        message: message.trim(),
        timestamp: extractTimestamp(message),
        severity: detectSeverity(message),
      }));
      const agentEntries = agentErrors.map((message) => ({
        source: "agent",
        message: message.trim(),
        timestamp: extractTimestamp(message),
        severity: detectSeverity(message),
      }));

      const allEntries = [...gatewayEntries, ...agentEntries];

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
      insertErrorLogEntries(uniqueEntries, ingestedAt);

      // Prune old entries — keep only the most recent 500
      pruneErrorLogEntries();

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
