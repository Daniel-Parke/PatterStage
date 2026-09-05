// ═══════════════════════════════════════════════════════════════
// hardware-cron-handlers/crontab-store.ts - read, parse, serialise
// ═══════════════════════════════════════════════════════════════
//
// Extracted from the /api/cron/hardware route god-file. This module is the
// only place that knows the on-disk crontab format: how a managed line is
// recognised, how it maps to a job record, and how a job record maps back
// to a line. The handlers work in job records, never in raw text.

import { crontabLineUsesScriptsDir } from "@/lib/hardware-cron";
import { getHostScheduler } from "@/lib/host-scheduler";
import { getPsScriptsDir } from "@/lib/paths";
import { extractScriptName, SCRIPT_EXT_RE } from "@/lib/scripts/script-ext";

import { loadDisabledIds } from "./disabled-state";

/**
 * Parse a crontab line into a structured job.
 * Returns null for lines we don't manage.
 */
export function parseCrontabLine(
  line: string,
): {
  id: string;
  raw: string;
  schedule: string;
  command: string;
  logFile: string;
  name: string;
  enabled: boolean;
} | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) return null;

  if (!crontabLineUsesScriptsDir(trimmed, getPsScriptsDir())) return null;

  const parts = trimmed.split(/\s+/);
  if (parts.length < 6) return null;

  const [min, hour, dom, mon, dow, ...rest] = parts;
  const schedule = [min, hour, dom, mon, dow].join(" ");

  // Extract command (everything after the 5 schedule fields)
  const fullCmd = rest.join(" ");

  // Extract log file: `>> /path/to.log 2>&1`
  const logMatch = fullCmd.match(/>>\s*(\S+\.log)\s*2>/);
  const logFile = logMatch ? logMatch[1] : "";
  // Remove log redirection from command
  const command = fullCmd.replace(/>>\s*\S+\.log\s*2>.*$/, "").trim();

  // Extract script name for ID and display name
  const scriptName = extractScriptName(command);
  const id =
    scriptName.replace(SCRIPT_EXT_RE, "") ||
    command.split(" ")[0]?.split(/[/\\]/).pop() ||
    "unknown";

  // Name from script: ps-backup → PatterStage Backup
  const name = scriptName
    .replace(/^(?:ps|ch)-/, "PatterStage ")
    .replace(SCRIPT_EXT_RE, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return { id, raw: trimmed, schedule, command, logFile, name, enabled: true };
}

/**
 * Serialise a job into a crontab line.
 */
export function serialiseLine(
  schedule: string,
  command: string,
  logFile: string
): string {
  // Preserve the original command with any env vars
  const logRedirect = logFile ? ` >> ${logFile} 2>&1` : "";
  return `${schedule} ${command}${logRedirect}`;
}

// ── Read / write crontab ───────────────────────────────────────

// Cross-platform: crontab on Unix, Task Scheduler (schtasks) on Windows. The
// scheduler presents the managed jobs as crontab-format text either way, so the
// parse/serialise logic above is unchanged. See src/lib/host-scheduler.ts.
export function readCrontab(): Promise<string> {
  return getHostScheduler().readRaw();
}

export function writeCrontab(content: string): Promise<{ ok: boolean; error?: string }> {
  return getHostScheduler().writeRaw(content);
}

/**
 * Join a list of crontab lines into the on-disk format. The
 * `.filter((l) => l.trim() || l === "")` step preserves intentionally
 * empty lines (used as separators between job blocks) while dropping
 * lines that are only whitespace. Centralised so the 3 call sites
 * (POST create, PUT update, PUT delete) use the same exact filter
 * discipline — a future "preserve lines containing only a `#`" change
 * lands in one place.
 */
export function joinCrontabLines(lines: string[]): string {
  return lines.filter((l) => l.trim() || l === "").join("\n");
}

// ── Shared crontab read+parse helper ─────────────────────────

interface CrontabJobRaw {
  id: string;
  name: string;
  schedule: string;
  command: string;
  logFile: string;
}

export async function readAndParseCrontab(): Promise<{ jobs: CrontabJobRaw[]; disabledIds: Set<string> }> {
  const crontab = await readCrontab();
  const disabledIds = loadDisabledIds();
  const lines = crontab.split("\n");
  const jobs = lines
    .map(parseCrontabLine)
    .filter((j): j is NonNullable<typeof j> => j !== null)
    .map((j) => ({
      id: j.id,
      name: j.name,
      schedule: j.schedule,
      enabled: !disabledIds.has(j.id),
      command: j.command,
      logFile: j.logFile,
    }));
  return { jobs, disabledIds };
}
