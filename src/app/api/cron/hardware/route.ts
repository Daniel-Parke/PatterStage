import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import { exec, execSync } from "child_process";
import { join } from "path";

import { logApiError } from "@/lib/api-logger";
import { requireAuth, isChReadOnly } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { badRequest } from "@/lib/api-response";
import { toError } from "@/lib/api-fetch";
import { crontabLineUsesScriptsDir } from "@/lib/hardware-cron";
import { getChScriptsDir, getChHardwareLogDir, CH_DATA_DIR } from "@/lib/paths";

/**
 * Hardware Cron API — System crontab management
 *
 * GET    /api/cron/hardware         — List all hardware cron jobs
 * POST   /api/cron/hardware         — Create a new hardware cron job (or { action: "pauseAll" } to disable all)
 * PUT    /api/cron/hardware         — Update an existing hardware cron job
 * DELETE /api/cron/hardware?id=...  — Delete a hardware cron job by ID
 *
 * Hardware cron jobs are system cron entries managed via crontab(1).
 * They survive agent restarts and run independently of any agent install.
 *
 * Entry format in crontab:
 *   {min} {hour} {dom} {mon} {dow} HOME={homedir} {cmd} >> {log} 2>&1
 *
 * We identify our managed entries by their script path prefix:
 *   CH_SCRIPTS_DIR (default: CH_DATA_DIR/scripts)
 */

const DISABLED_STATE_FILE = join(CH_DATA_DIR, ".disabled_hardware_crons.json");

/** Load the set of disabled hardware cron job IDs */
function loadDisabledIds(): Set<string> {
  try {
    const raw = fs.readFileSync(DISABLED_STATE_FILE, "utf-8");
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/** Persist the set of disabled hardware cron job IDs */
function saveDisabledIds(ids: Set<string>): void {
  try {
    fs.writeFileSync(DISABLED_STATE_FILE, JSON.stringify(Array.from(ids), null, 2), { mode: 0o600 });
  } catch (err) {
    logApiError("cron/hardware", "saveDisabledIds", err);
  }
}

// ── Parse / serialise helpers ───────────────────────────────────

/**
 * Extract the script basename (e.g. "ch-backup.sh") from a command string,
 * or empty string if the command does not invoke a ch-* script.
 *
 * Used by both `parseCrontabLine` (read) and the POST handler (write) to
 * derive a stable entry ID from the command body. The match anchors on
 * `/ch-` so we don't pick up other paths in the command (env vars,
 * redirected log file paths, etc.).
 */
function extractScriptName(command: string): string {
  const m = command.match(/(\S+\/ch-[^\s]+)/);
  return m ? m[1].split("/").pop()! : "";
}

/**
 * Apply an enable/disable flag to the disabledIds set:
 *   enabled === false → add
 *   enabled === true  → delete
 *   enabled === undefined → no-op (skip)
 *
 * Shared by PUT (toggle-only branch) and PUT (non-toggle branch's
 * post-write sync), so the "if (enabled === false) add else delete"
 * tri-state lives in exactly one place.
 */
function setDisabled(disabledIds: Set<string>, id: string, enabled: boolean | undefined): void {
  if (enabled === undefined) return;
  if (enabled === false) {
    disabledIds.add(id);
  } else {
    disabledIds.delete(id);
  }
}

/**
 * Return a 400 NextResponse if `command` is set and doesn't run a script
 * under the CH scripts dir. Returns null when the command is acceptable
 * (or undefined — in which case the caller is not editing the command
 * field and the check is skipped). Shared between POST (create) and PUT
 * (update).
 */
function rejectIfBadScriptsCommand(command: string | undefined): NextResponse | null {
  if (command === undefined) return null;
  const scriptsDir = getChScriptsDir();
  if (!crontabLineUsesScriptsDir(command, scriptsDir)) {
    return badRequest(
      `Command must run a script under ${scriptsDir} (Control Hub hardware cron scripts directory).`,
    );
  }
  return null;
}

/**
 * Parse a crontab line into a structured job.
 * Returns null for lines we don't manage.
 */
function parseCrontabLine(
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

  if (!crontabLineUsesScriptsDir(trimmed, getChScriptsDir())) return null;

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
    scriptName.replace(/\.sh$/, "") ||
    command.split(" ")[0]?.split("/").pop() ||
    "unknown";

  // Name from script: ch-backup → Control Hub Backup
  const name = scriptName
    .replace(/^ch-/, "Control Hub ")
    .replace(/-/g, " ")
    .replace(/\.sh$/, "")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return { id, raw: trimmed, schedule, command, logFile, name, enabled: true };
}

/**
 * Serialise a job into a crontab line.
 */
function serialiseLine(
  schedule: string,
  command: string,
  logFile: string
): string {
  // Preserve the original command with any env vars
  const logRedirect = logFile ? ` >> ${logFile} 2>&1` : "";
  return `${schedule} ${command}${logRedirect}`;
}

// ── Read / write crontab ───────────────────────────────────────

function readCrontab(): Promise<string> {
  return new Promise<string>((resolve) => {
    exec("crontab -l", { encoding: "utf-8" }, (error, stdout) => {
      resolve(error ? "" : (stdout as string));
    });
  });
}

function writeCrontab(content: string): { ok: boolean; error?: string } {
  const tmpFile = `/tmp/ch-crontab-${Date.now()}.txt`;
  try {
    fs.writeFileSync(tmpFile, content + "\n", { mode: 0o600 });
    execSync(`crontab ${tmpFile}`, { encoding: "utf-8" });
    fs.unlinkSync(tmpFile);
    return { ok: true };
  } catch (e: unknown) {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    return { ok: false, error: toError(e).message };
  }
}

// ── Shared crontab read+parse helper ─────────────────────────

interface CrontabJobRaw {
  id: string;
  name: string;
  schedule: string;
  command: string;
  logFile: string;
}

async function readAndParseCrontab(): Promise<{ jobs: CrontabJobRaw[]; disabledIds: Set<string> }> {
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

// ── API handlers ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { jobs } = await readAndParseCrontab();
    return NextResponse.json({ data: { jobs, total: jobs.length } });
  } catch (e: unknown) {
    logApiError("GET /api/cron/hardware", "read crontab", e);
    return NextResponse.json({ error: `Failed to read crontab: ${toError(e).message}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  if (isChReadOnly()) {
    return NextResponse.json({ error: "Control Hub is in read-only mode" }, { status: 503 });
  }

  try {
    const bodyResult = await parseJsonBody(request);
    if (bodyResult instanceof NextResponse) return bodyResult;
    const body = bodyResult;

    // ── pauseAll action ────────────────────────────────────────────────
    if ((body as Record<string, unknown>).action === "pauseAll") {
      const disabledIds = loadDisabledIds();
      const crontab = await readCrontab();
      const lines = crontab.split("\n");
      const jobIds: string[] = [];

      for (const line of lines) {
        const parsed = parseCrontabLine(line);
        if (parsed) {
          jobIds.push(parsed.id);
          disabledIds.add(parsed.id);
        }
      }

      saveDisabledIds(disabledIds);
      return NextResponse.json({ data: { success: true, pausedCount: jobIds.length } });
    }

    // ── Sync action ───────────────────────────────────────────────────
    // Re-read crontab and return all detected hardware cron jobs.
    // This picks up any jobs added or modified outside Control Hub.
    if ((body as Record<string, unknown>).action === "sync") {
      const { jobs } = await readAndParseCrontab();
      return NextResponse.json({ data: { jobs, total: jobs.length } });
    }

    // ── Create new hardware cron job ────────────────────────────────────
    const { schedule, command, name, logFile } = body as {
      schedule?: string;
      command?: string;
      name?: string;
      logFile?: string;
    };

    if (!schedule || !command) {
      return badRequest("schedule and command are required");
    }

    // Basic cron validation — 5 fields
    const fields = schedule.trim().split(/\s+/);
    if (fields.length !== 5) {
      return badRequest("Schedule must have exactly 5 fields: min hour dom mon dow");
    }

    const badCmd = rejectIfBadScriptsCommand(command);
    if (badCmd) return badCmd;

    const crontab = await readCrontab();
    const lines = crontab.split("\n");

    // Check if this script already has an entry (replace if so)
    const scriptName = extractScriptName(command);
    const entryId = scriptName.replace(/\.sh$/, "") || "hw";

    const logDir = getChHardwareLogDir();
    const newLine = serialiseLine(schedule, command, logFile || `${logDir}/${entryId}.log`);
    const newLines: string[] = [];
    let replaced = false;

    for (const line of lines) {
      const parsed = parseCrontabLine(line);
      if (parsed && parsed.id === entryId) {
        // Replace existing entry for this script
        if (name) {
          newLines.push(`# ${name}`);
        }
        newLines.push(newLine);
        replaced = true;
      } else {
        newLines.push(line);
      }
    }

    if (!replaced) {
      if (name) {
        newLines.push(`# ${name}`);
      }
      newLines.push(newLine);
    }

    // Write crontab synchronously (execSync is acceptable here — it is a
    // single blocking call with no async I/O available for crontab writes).
    const result = writeCrontab(newLines.filter((l) => l.trim() || l === "").join("\n"));
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      data: { id: entryId, schedule, command, name, logFile },
    });
  } catch (e: unknown) {
    logApiError("POST /api/cron/hardware", "create hardware cron", e);
    return NextResponse.json({ error: `Failed to create hardware cron job: ${toError(e).message}` }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  if (isChReadOnly()) {
    return NextResponse.json({ error: "Control Hub is in read-only mode" }, { status: 503 });
  }

  try {
    const bodyResult = await parseJsonBody(request);
    if (bodyResult instanceof NextResponse) return bodyResult;
    const body = bodyResult;

    const { id, schedule, command, name, logFile, enabled } = body as {
      id?: string;
      schedule?: string;
      command?: string;
      name?: string;
      logFile?: string;
      enabled?: boolean;
    };

    if (!id) {
      return badRequest("id is required");
    }

    const crontab = await readCrontab();
    const disabledIds = loadDisabledIds();
    const lines = crontab.split("\n");
    const newLines: string[] = [];
    let found = false;

    // Separate: only toggle changes JSON; schedule/command/name changes rewrite crontab
    const isToggleOnly =
      enabled !== undefined &&
      schedule === undefined &&
      command === undefined &&
      name === undefined &&
      logFile === undefined;

    for (const line of lines) {
      const parsed = parseCrontabLine(line);
      if (parsed && parsed.id === id) {
        found = true;
        const newSchedule = schedule || parsed.schedule;
        const newCommand = command || parsed.command;
        const newLogFile = logFile || parsed.logFile;

        // Only rewrite crontab for non-toggle changes
        if (!isToggleOnly) {
          // Remove preceding comment if it was for this entry
          if (newLines.length > 0 && newLines[newLines.length - 1].startsWith("# ")) {
            newLines.pop();
          }
          if (name) newLines.push(`# ${name}`);
          newLines.push(serialiseLine(newSchedule, newCommand, newLogFile));
        }
      } else {
        newLines.push(line);
      }
    }

    if (!found) {
      return NextResponse.json({ error: `Hardware cron job '${id}' not found` }, { status: 404 });
    }

    const badCmd = rejectIfBadScriptsCommand(command);
    if (badCmd) return badCmd;

    // Toggle-only: update JSON state, no crontab change
    if (isToggleOnly) {
      setDisabled(disabledIds, id, enabled);
      saveDisabledIds(disabledIds);
      return NextResponse.json({ data: { id, enabled } });
    }

    const result = writeCrontab(newLines.filter((l) => l.trim() || l === "").join("\n"));
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Sync disabled state to JSON for this job
    if (enabled !== undefined) {
      setDisabled(disabledIds, id, enabled);
      saveDisabledIds(disabledIds);
    }

    return NextResponse.json({ data: { id, schedule, command, name, logFile, enabled } });
  } catch (e: unknown) {
    logApiError("PUT /api/cron/hardware", "update hardware cron", e);
    return NextResponse.json({ error: `Failed to update hardware cron job: ${toError(e).message}` }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  if (isChReadOnly()) {
    return NextResponse.json({ error: "Control Hub is in read-only mode" }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return badRequest("id is required");
    }

    const crontab = await readCrontab();
    const lines = crontab.split("\n");
    const newLines: string[] = [];
    let found = false;

    for (const line of lines) {
      const parsed = parseCrontabLine(line);
      if (parsed && parsed.id === id) {
        found = true;
        // Skip this line (and preceding comment if any)
        continue;
      }
      // Skip comment lines that immediately precede a deleted entry
      const prev = newLines[newLines.length - 1];
      if (!parsed && prev?.startsWith("# ") && line.trim() === "") {
        newLines.pop();
        continue;
      }
      newLines.push(line);
    }

    if (!found) {
      return NextResponse.json({ error: `Hardware cron job '${id}' not found` }, { status: 404 });
    }

    const result = writeCrontab(newLines.filter((l) => l.trim() || l === "").join("\n"));
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Remove from disabled set if present
    const disabledIds = loadDisabledIds();
    disabledIds.delete(id);
    saveDisabledIds(disabledIds);

    return NextResponse.json({ data: { id } });
  } catch (e: unknown) {
    logApiError("DELETE /api/cron/hardware", "delete hardware cron", e);
    return NextResponse.json({ error: `Failed to delete hardware cron job: ${toError(e).message}` }, { status: 500 });
  }
}
