import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import { execSync, ExecSyncOptions } from "child_process";

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

const DISABLED_STATE_FILE = CH_DATA_DIR + "/.disabled_hardware_crons.json";

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
  } catch {}
}

// ── Parse / serialise helpers ───────────────────────────────────

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
  const scriptMatch = command.match(/(\S+\/ch-[^\s]+)/);
  const scriptName = scriptMatch ? scriptMatch[1].split("/").pop()! : "";
  const id =
    scriptName.replace(/\.sh$/, "") ||
    command.split(" ")[0]?.split("/").pop() ||
    "unknown";

  // Name from script: ch-watchdog → Control Hub Watchdog
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
    try {
      const out = execSync("crontab -l 2>/dev/null", { encoding: "utf-8" } as ExecSyncOptions);
      resolve(out as string);
    } catch {
      resolve("");
    }
  });
}

function writeCrontab(content: string): { ok: boolean; error?: string } {
  const tmpFile = `/tmp/ch-crontab-${Date.now()}.txt`;
  try {
    // Write to a temp file first, then pipe to crontab.
    // This avoids shell interpretation of >> 2>&1 and other special chars.
    fs.writeFileSync(tmpFile, content + "\n", { mode: 0o600 });
    execSync(`crontab ${tmpFile}`, { encoding: "utf-8" });
    fs.unlinkSync(tmpFile);
    return { ok: true };
  } catch (e: unknown) {
    try { fs.unlinkSync(tmpFile); } catch {}
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

// ── API handlers ───────────────────────────────────────────────

export async function GET() {
  try {
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

    return NextResponse.json({ data: { jobs, total: jobs.length } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Failed to read crontab: ${msg}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── pauseAll action ────────────────────────────────────────────────
    if (body && typeof body === "object" && (body as Record<string, unknown>).action === "pauseAll") {
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
    if (body && typeof body === "object" && (body as Record<string, unknown>).action === "sync") {
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
      return NextResponse.json(
        { error: "schedule and command are required" },
        { status: 400 }
      );
    }

    // Basic cron validation — 5 fields
    const fields = schedule.trim().split(/\s+/);
    if (fields.length !== 5) {
      return NextResponse.json(
        { error: "Schedule must have exactly 5 fields: min hour dom mon dow" },
        { status: 400 }
      );
    }

    const scriptsDir = getChScriptsDir();
    if (!crontabLineUsesScriptsDir(command, scriptsDir)) {
      return NextResponse.json(
        {
          error: `Command must run a script under ${scriptsDir} (Control Hub hardware cron scripts directory).`,
        },
        { status: 400 }
      );
    }

    const crontab = await readCrontab();
    const lines = crontab.split("\n");

    // Check if this script already has an entry (replace if so)
    const scriptMatch = command.match(/(\S+\/ch-[^\s]+)/);
    const scriptName = scriptMatch ? scriptMatch[1].split("/").pop()! : "";
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

    const result = writeCrontab(newLines.filter((l) => l.trim() || l === "").join("\n"));
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      data: { id: entryId, schedule, command, name, logFile },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Failed to create hardware cron job: ${msg}` }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, schedule, command, name, logFile, enabled } = body as {
      id?: string;
      schedule?: string;
      command?: string;
      name?: string;
      logFile?: string;
      enabled?: boolean;
    };

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
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

    const scriptsDir = getChScriptsDir();
    if (
      command !== undefined &&
      !crontabLineUsesScriptsDir(command, scriptsDir)
    ) {
      return NextResponse.json(
        {
          error: `Command must run a script under ${scriptsDir} (Control Hub hardware cron scripts directory).`,
        },
        { status: 400 }
      );
    }

    // Toggle-only: update JSON state, no crontab change
    if (isToggleOnly) {
      if (enabled === false) {
        disabledIds.add(id);
      } else {
        disabledIds.delete(id);
      }
      saveDisabledIds(disabledIds);
      return NextResponse.json({ data: { id, enabled } });
    }

    const result = writeCrontab(newLines.filter((l) => l.trim() || l === "").join("\n"));
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Sync disabled state to JSON for this job
    if (enabled !== undefined) {
      if (enabled === false) {
        disabledIds.add(id);
      } else {
        disabledIds.delete(id);
      }
      saveDisabledIds(disabledIds);
    }

    return NextResponse.json({ data: { id, schedule, command, name, logFile, enabled } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Failed to update hardware cron job: ${msg}` }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
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
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Failed to delete hardware cron job: ${msg}` }, { status: 500 });
  }
}
