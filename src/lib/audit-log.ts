// ═══════════════════════════════════════════════════════════════
// Lightweight audit trail (no secrets)
// ═══════════════════════════════════════════════════════════════

import { appendFileSync } from "fs";

import { PATHS } from "@/lib/paths";
import { ensureDir } from "@/lib/fs/fs-helpers";

function ensureLogsDir(): void {
  ensureDir(PATHS.auditLog);
}

/**
 * Append one JSON line: { ts, action, resource, ok, detail? }.
 */
export function appendAuditLine(entry: {
  action: string;
  resource: string;
  ok: boolean;
  detail?: string;
  correlationId?: string;
}): void {
  try {
    ensureLogsDir();
    const line =
      JSON.stringify({
        ts: new Date().toISOString(),
        ...entry,
      }) + "\n";
    appendFileSync(PATHS.auditLog + "/ps-audit.log", line, "utf-8");
  } catch {
    // never throw from audit
  }
}
