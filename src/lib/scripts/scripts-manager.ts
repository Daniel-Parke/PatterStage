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
// A run ends in one of three ways, and this file is where they are told apart:
// it ran and succeeded, it ran and failed, or it never started. The third was
// reported as the second for as long as the page existed, which sent operators
// to a log that had nothing in it. Each run PatterStage starts is recorded in
// the analytics ledger, and `listScriptFiles` reads the last one back, so the
// row can answer "did last night's backup work?" after the toast has gone.
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
import { getPsScriptsDir, getPsHardwareLogDir } from "@/lib/host/paths";
import { interpreterFor } from "@/lib/host/platform";
import { getHostScheduler } from "@/lib/host/host-scheduler";
import {
  SCRIPT_EXT_LIST,
  SCRIPT_EXT_RE,
  extractScriptName,
  hasScriptExt,
  stripScriptExt,
} from "@/lib/scripts/script-ext";
import { listScriptSchedules, type ScheduleRecord } from "@/lib/schedule/schedules-repository";
import { latestEventPerEntity } from "@/lib/analytics/analytics-repository";

/** Max script size accepted by the editor write API (256 KB). */
const MAX_SCRIPT_BYTES = 256 * 1024;

/** How long a run may take, and how much output it may produce, before it is stopped. */
const RUN_TIMEOUT_MS = 10 * 60_000;
const RUN_MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

/**
 * How a run ended.
 *
 * "not-started" is the one this file could not say before, and it is not a
 * pedantic distinction: a script that never started has no exit code and wrote
 * no output, so reporting it as "exited non-zero, check Logs" sends the
 * operator to a log that says nothing about it.
 */
type ScriptRunOutcome = "succeeded" | "failed" | "not-started";

/**
 * Why a run did not start. The route answers 404 for the first and 503 for the
 * second: one is a script that is not there, the other is a host that cannot
 * run the script it has.
 */
type ScriptStartFailure = "script-missing" | "host-cannot-run";

/** The types the ledger records a run under. `script.run` means it ran. */
const RUN_EVENT_TYPES = ["script.run", "script.run_not_started"] as const;

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
  /**
   * How the last run the ledger recorded ended, or null when it holds none for
   * this script (or holds one too old to say). The log's mtime above says WHEN
   * something last wrote output; this says whether it worked.
   */
  lastOutcome: ScriptRunOutcome | null;
  /** When that recorded run happened (ISO), or null when there is none. */
  lastOutcomeAt: string | null;
  /** The code that run returned, when it ran at all. */
  lastExitCode: number | null;
}

export interface RunScriptResult {
  ok: boolean;
  /** Which of the three things happened. `ok` alone cannot tell the last two apart. */
  outcome: ScriptRunOutcome;
  /** Set when, and only when, the outcome is "not-started". */
  startFailure?: ScriptStartFailure;
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

/** What the ledger says about one script's last run. */
interface RecordedRun {
  outcome: ScriptRunOutcome | null;
  at: string;
  exitCode: number | null;
}

/**
 * The last recorded run per script, from the analytics ledger.
 *
 * The ledger is the record the product already keeps of what an operator did,
 * and a script run has been in it since B4; nothing had ever read it back, so
 * the outcome lived in one toast and then nowhere. Rows written before the
 * outcome was recorded carry only an exit code, and are read from that; a row
 * that carries neither says nothing rather than guessing, because a wrong
 * "succeeded" on last night's backup is worse than a blank.
 */
function recordedRuns(): Map<string, RecordedRun> {
  const out = new Map<string, RecordedRun>();
  // Same try/catch as the schedule read below, for the same reason: this runs
  // on a route that must still list files before the database exists.
  try {
    for (const ev of latestEventPerEntity("script", RUN_EVENT_TYPES)) {
      const meta = parseMetadata(ev.metadataJson);
      const exitCode = typeof meta.exitCode === "number" ? meta.exitCode : null;
      out.set(ev.entityId, { outcome: outcomeOf(ev.eventType, meta, exitCode), at: ev.createdAt, exitCode });
    }
  } catch {
    /* no database yet; the file listing is still worth answering */
  }
  return out;
}

function parseMetadata(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function outcomeOf(
  eventType: string,
  meta: Record<string, unknown>,
  exitCode: number | null,
): ScriptRunOutcome | null {
  if (eventType === "script.run_not_started") return "not-started";
  const recorded = meta.outcome;
  if (recorded === "succeeded" || recorded === "failed" || recorded === "not-started") return recorded;
  if (exitCode === null) return null;
  return exitCode === 0 ? "succeeded" : "failed";
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
  const runs = recordedRuns();
  const files = readdirSync(dir).filter(hasScriptExt).sort();
  return files.map((name) => {
    const abs = join(dir, name);
    const st = statSync(abs);
    const logFile = logPathFor(name);
    const hasLog = existsSync(logFile);
    const host = hostSchedules.get(name) ?? null;
    const mine = host ? null : own.get(name) ?? null;
    const run = runs.get(name) ?? null;
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
      lastOutcome: run?.outcome ?? null,
      // Only alongside an outcome: a time with nothing to say about it is
      // already covered by lastRun above.
      lastOutcomeAt: run?.outcome ? run.at : null,
      lastExitCode: run?.exitCode ?? null,
    };
  });
}

/** Append one line to a script's log. Best-effort, as all logging here is. */
function appendToLog(logFile: string, text: string): void {
  try {
    appendFileSync(logFile, text);
  } catch {
    /* logging is best-effort: a run is not failed by a log that would not write */
  }
}

/**
 * Read node's execFile error, which carries three different failures in one
 * shape and tells them apart only by which fields are set:
 *
 *   - a NUMBER code is an exit status: the script ran and returned it;
 *   - `killed`/`signal` is a process we started and then stopped (the time
 *     limit, or the output cap);
 *   - anything else with a STRING code (ENOENT, EACCES) is a spawn that never
 *     happened, and there is no exit status because nothing exited.
 *
 * The old reader collapsed the last two into `exitCode: 1`, which is how a
 * missing interpreter came to be reported as a script that exited non-zero.
 */
function readExecError(err: Error, command: string): RunScriptResult {
  const code = (err as { code?: unknown }).code;
  const killed = (err as { killed?: unknown }).killed === true || typeof (err as { signal?: unknown }).signal === "string";
  if (typeof code === "number") {
    return { ok: false, outcome: "failed", exitCode: code, error: err.message, logFile: "" };
  }
  if (killed) {
    const tooMuchOutput = code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
    return {
      ok: false,
      outcome: "failed",
      exitCode: null,
      error: tooMuchOutput
        ? `The script was stopped after printing more than ${Math.round(RUN_MAX_OUTPUT_BYTES / 1024 / 1024)} MB`
        : `The script was stopped after ${Math.round(RUN_TIMEOUT_MS / 60_000)} minutes`,
      logFile: "",
    };
  }
  return {
    ok: false,
    outcome: "not-started",
    startFailure: "host-cannot-run",
    exitCode: null,
    // Names the command that could not be started, because that is the thing
    // the operator has to install or fix.
    error: `${command} could not be started (${String(code ?? err.message)})`,
    logFile: "",
  };
}

/** Run a script on demand. Path-validated; output is appended to its log. */
export function runScriptFile(name: string): Promise<RunScriptResult> {
  return new Promise((res) => {
    const abs = resolveScriptPath(name);
    if (!abs) {
      res({
        ok: false,
        outcome: "not-started",
        startFailure: "script-missing",
        exitCode: null,
        error: "Script not found under the scripts directory",
        logFile: "",
      });
      return;
    }
    const logFile = logPathFor(name);
    try {
      mkdirSync(getPsHardwareLogDir(), { recursive: true });
    } catch {
      /* logging is best-effort */
    }
    appendToLog(logFile, `\n===== run ${new Date().toISOString()} =====\n`);
    // Resolve the interpreter by extension + OS (node/.sh-bash/PowerShell/cmd).
    const interp = interpreterFor(abs);
    if (!interp) {
      // The extension comes from the one rule, not a second list of endings.
      const ext = name.match(SCRIPT_EXT_RE)?.[0] ?? "";
      const error = `nothing on this machine can run ${ext} files`;
      // Into the log as well as into the answer: the operator who opens Logs
      // after a failed run used to find the run header and nothing under it.
      appendToLog(logFile, `did not start: ${error}\n`);
      res({ ok: false, outcome: "not-started", startFailure: "host-cannot-run", exitCode: null, error, logFile });
      return;
    }
    // No shell, no user args — the resolved interpreter runs the validated path only.
    execFile(interp.cmd, interp.args, { timeout: RUN_TIMEOUT_MS, maxBuffer: RUN_MAX_OUTPUT_BYTES }, (err, stdout, stderr) => {
      appendToLog(logFile, `${stdout ?? ""}${stderr ?? ""}`);
      if (!err) {
        res({ ok: true, outcome: "succeeded", exitCode: 0, logFile });
        return;
      }
      const result = readExecError(err, interp.cmd);
      if (result.outcome === "not-started") appendToLog(logFile, `did not start: ${result.error}\n`);
      res({ ...result, logFile });
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
