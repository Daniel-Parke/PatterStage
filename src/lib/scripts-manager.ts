// ═══════════════════════════════════════════════════════════════
// scripts-manager.ts — host script files under PS_DATA_DIR/scripts
//
// Powers the Scripts page's file-aware view: list the script files an operator
// has dropped under getPsScriptsDir(), cross-reference their schedules, run one
// on demand (path-validated, no shell), and tail its log under
// getPsHardwareLogDir().
//
// Seven extensions, not one: .sh, .mjs, .cjs, .js, .ps1, .bat and .cmd, all
// named once in @/lib/scripts/script-ext.ts. The header used to say ".sh only"
// in four places while the product shipped .mjs scripts and ran .ps1 (T-0107).
//
// A schedule can live in two places. The host crontab is the first, and the
// better one: those rows fire whether PatterStage is up or not. Where the host
// has none (native Windows) a PatterStage `schedules` row carries it instead,
// and a row says which of the two it is on so the difference is never silent.
//
// SECURITY: every operation resolves the script to an absolute path that MUST
// live directly under getPsScriptsDir() (no traversal, no slashes, one of the
// seven extensions). Execution goes through execFile with the interpreter the
// extension names — no shell string, no user-supplied arguments — so there is
// no command-injection surface.
// ═══════════════════════════════════════════════════════════════

import {
  readdirSync,
  statSync,
  existsSync,
  readFileSync,
  appendFileSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  chmodSync,
} from "fs";
import { join } from "path";
import { execFile } from "child_process";
import { getPsScriptsDir, getPsHardwareLogDir } from "@/lib/paths";
import { interpreterFor } from "@/lib/platform";
import { getHostScheduler } from "@/lib/host-scheduler";
import {
  SCRIPT_EXT_LIST,
  extractScriptName,
  hasScriptExt,
  stripScriptExt,
} from "@/lib/scripts/script-ext";
import { listScriptSchedules, type ScheduleRecord } from "@/lib/schedules-repository";

/** Max script size accepted by the editor write API (256 KB). */
const MAX_SCRIPT_BYTES = 256 * 1024;

export interface ScriptFile {
  name: string; // e.g. "ps-backup.sh"
  path: string; // absolute path under the scripts dir (for crontab scheduling)
  size: number;
  modified: string; // ISO mtime of the script file
  schedule: string | null; // 5-field cron, from whichever source owns it
  /** Where this row's schedule lives. null when it has none. */
  scheduleSource: "host" | "patterstage" | null;
  /** The `schedules.id` when scheduleSource === "patterstage", else null. */
  scheduleId: string | null;
  hasLog: boolean;
  lastRun: string | null; // ISO mtime of the log (a proxy for "last ran")
}

export interface RunScriptResult {
  ok: boolean;
  exitCode: number | null;
  error?: string;
  logFile: string;
}

function logPathFor(name: string): string {
  return join(getPsHardwareLogDir(), `${stripScriptExt(name)}.log`);
}

/**
 * Resolve a script name to an absolute path that lives DIRECTLY under the
 * scripts dir, or null if it is unsafe / missing. Rejects traversal, nested
 * paths, and names that end in none of the seven script extensions.
 */
export function resolveScriptPath(name: string): string | null {
  // The string checks alone prevent traversal: a name with no slash, no
  // backslash and no ".." cannot escape the scripts dir.
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  if (!hasScriptExt(name)) return null;
  const abs = join(getPsScriptsDir(), name);
  if (!existsSync(abs)) return null;
  return abs;
}

/**
 * Validate a script NAME's format (no traversal, no slashes, .sh only) WITHOUT
 * requiring it to exist — used by create. Returns the would-be absolute path
 * under the scripts dir, or null when the name is unsafe.
 */
export function scriptPathForName(name: string): string | null {
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  if (!hasScriptExt(name)) return null;
  // basename sanity: letters, digits, dash, underscore, dot only.
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return null;
  return join(getPsScriptsDir(), name);
}

export interface WriteScriptResult {
  ok: boolean;
  error?: string;
  created?: boolean;
}

/** Read a script's contents, or null if missing / unsafe name. */
export function readScriptContent(name: string): string | null {
  const abs = resolveScriptPath(name);
  if (!abs) return null;
  return readFileSync(abs, "utf-8");
}

/**
 * Create or overwrite a script. Validates the name format + size. On create,
 * marks it executable. `mode` guards intent: "create" fails if it already
 * exists; "update" fails if it does not.
 */
export function writeScriptContent(
  name: string,
  content: string,
  mode: "create" | "update",
): WriteScriptResult {
  const abs = scriptPathForName(name);
  if (!abs) return { ok: false, error: `Invalid script name (letters, digits, -, _, . and one of ${SCRIPT_EXT_LIST})` };
  if (typeof content !== "string") return { ok: false, error: "Missing script content" };
  if (Buffer.byteLength(content, "utf-8") > MAX_SCRIPT_BYTES) {
    return { ok: false, error: `Script exceeds the ${Math.round(MAX_SCRIPT_BYTES / 1024)} KB limit` };
  }
  const exists = existsSync(abs);
  if (mode === "create" && exists) return { ok: false, error: "A script with that name already exists" };
  if (mode === "update" && !exists) return { ok: false, error: "Script not found" };
  try {
    mkdirSync(getPsScriptsDir(), { recursive: true });
    writeFileSync(abs, content, { encoding: "utf-8" });
    if (!exists) {
      try {
        chmodSync(abs, 0o755);
      } catch {
        /* chmod is best-effort (e.g. on Windows) */
      }
    }
    return { ok: true, created: !exists };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Delete a script. Path-validated; returns false if missing / unsafe. */
export function deleteScriptFile(name: string): boolean {
  const abs = resolveScriptPath(name);
  if (!abs) return false;
  try {
    unlinkSync(abs);
    return true;
  } catch {
    return false;
  }
}

function readHostCrontab(): Promise<string> {
  // Cross-platform: crontab on Unix, schtasks-backed text on Windows.
  return getHostScheduler().readRaw();
}

/**
 * Map script basename → its 5-field cron schedule from the host crontab.
 *
 * The match used to be a hand-rolled `/(\S+\.sh)\b/`, so a scheduled .mjs -- and
 * every script PatterStage itself ships is .mjs -- was listed as unscheduled
 * while its crontab line sat there firing (T-0107, D41). `extractScriptName`
 * reads the one rule, and requires a directory separator, so a redirected log
 * target on the same line is not mistaken for the script.
 */
function parseScheduleMap(crontab: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of crontab.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const parts = t.split(/\s+/);
    if (parts.length < 6) continue;
    const schedule = parts.slice(0, 5).join(" ");
    const cmd = parts.slice(5).join(" ");
    const base = extractScriptName(cmd);
    if (base && !map.has(base)) map.set(base, schedule);
  }
  return map;
}

/** List the script files under the scripts dir, with schedule + last-run hints. */
export async function listScriptFiles(): Promise<ScriptFile[]> {
  const dir = getPsScriptsDir();
  if (!existsSync(dir)) return [];
  const hostSchedules = parseScheduleMap(await readHostCrontab());
  // The host wins where both exist, so PatterStage's own rows are only read for
  // the files the crontab said nothing about. The try/catch is not decoration:
  // this runs on a route that must still list files before the database has
  // been bootstrapped.
  const own = new Map<string, ScheduleRecord>();
  try {
    for (const sc of listScriptSchedules()) if (sc.scriptName) own.set(sc.scriptName, sc);
  } catch {
    /* no database yet; the host crontab still answers */
  }
  const files = readdirSync(dir).filter(hasScriptExt).sort();
  return files.map((name) => {
    const abs = join(dir, name);
    const st = statSync(abs);
    const logFile = logPathFor(name);
    const hasLog = existsSync(logFile);
    const host = hostSchedules.get(name) ?? null;
    const mine = host ? null : own.get(name) ?? null;
    return {
      name,
      path: abs,
      size: st.size,
      modified: st.mtime.toISOString(),
      schedule: host ?? mine?.schedule ?? null,
      scheduleSource: host ? "host" : mine ? "patterstage" : null,
      scheduleId: mine?.id ?? null,
      hasLog,
      lastRun: hasLog ? statSync(logFile).mtime.toISOString() : null,
    };
  });
}

/** Run a script on demand. Path-validated; output is appended to its log. */
export function runScriptFile(name: string): Promise<RunScriptResult> {
  return new Promise((res) => {
    const abs = resolveScriptPath(name);
    if (!abs) {
      res({ ok: false, exitCode: null, error: "Script not found under the scripts directory", logFile: "" });
      return;
    }
    const logFile = logPathFor(name);
    try {
      mkdirSync(getPsHardwareLogDir(), { recursive: true });
      appendFileSync(logFile, `\n===== run ${new Date().toISOString()} =====\n`);
    } catch {
      /* logging is best-effort */
    }
    // Resolve the interpreter by extension + OS (node/.sh-bash/PowerShell/cmd).
    const interp = interpreterFor(abs);
    if (!interp) {
      res({ ok: false, exitCode: null, error: `No interpreter available for this script type on ${process.platform}`, logFile });
      return;
    }
    // No shell, no user args — the resolved interpreter runs the validated path only.
    execFile(interp.cmd, interp.args, { timeout: 10 * 60_000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      try {
        appendFileSync(logFile, `${stdout ?? ""}${stderr ?? ""}`);
      } catch {
        /* ignore */
      }
      const code = err && typeof (err as { code?: unknown }).code === "number" ? (err as { code: number }).code : err ? 1 : 0;
      res({ ok: !err, exitCode: code, error: err ? (err as Error).message : undefined, logFile });
    });
  });
}

/** Return the last `lines` of a script's log, or null if there is none. */
export function tailScriptLog(name: string, lines = 200): string | null {
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  const logFile = logPathFor(name);
  if (!existsSync(logFile)) return null;
  return readFileSync(logFile, "utf-8").split("\n").slice(-lines).join("\n");
}
