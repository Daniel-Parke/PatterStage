// ═══════════════════════════════════════════════════════════════
// scripts-manager.ts — host script files under CH_DATA_DIR/scripts
//
// Powers the Scripts page's file-aware view: list the *.sh files an operator
// has dropped under getChScriptsDir(), cross-reference the host crontab for each
// file's schedule, run a script on demand (path-validated, no shell), and tail
// its log under getChHardwareLogDir(). Scheduling itself stays with the existing
// /api/cron/hardware crontab manager.
//
// SECURITY: every operation resolves the script to an absolute path that MUST
// live directly under getChScriptsDir() (no traversal, no slashes, .sh only).
// Execution uses execFile("/bin/bash", [absPath]) — no shell string, no
// user-supplied arguments — so there is no command-injection surface.
// ═══════════════════════════════════════════════════════════════

import { readdirSync, statSync, existsSync, readFileSync, appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import { execFile, exec } from "child_process";
import { getChScriptsDir, getChHardwareLogDir } from "@/lib/paths";

export interface ScriptFile {
  name: string; // e.g. "ch-backup.sh"
  path: string; // absolute path under the scripts dir (for crontab scheduling)
  size: number;
  modified: string; // ISO mtime of the script file
  schedule: string | null; // 5-field cron if registered on the host crontab
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
  return join(getChHardwareLogDir(), `${name.replace(/\.sh$/, "")}.log`);
}

/**
 * Resolve a script name to an absolute path that lives DIRECTLY under the
 * scripts dir, or null if it is unsafe / missing. Rejects traversal, nested
 * paths, and non-.sh names.
 */
export function resolveScriptPath(name: string): string | null {
  // The string checks alone prevent traversal: a name with no slash, no
  // backslash and no ".." cannot escape the scripts dir. .sh only.
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  if (!name.endsWith(".sh")) return null;
  const abs = join(getChScriptsDir(), name);
  if (!existsSync(abs)) return null;
  return abs;
}

function readHostCrontab(): Promise<string> {
  return new Promise((res) => {
    exec("crontab -l", { encoding: "utf-8" }, (e, out) => res(e ? "" : String(out)));
  });
}

/** Map script basename → its 5-field cron schedule from the host crontab. */
function parseScheduleMap(crontab: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of crontab.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const parts = t.split(/\s+/);
    if (parts.length < 6) continue;
    const schedule = parts.slice(0, 5).join(" ");
    const cmd = parts.slice(5).join(" ");
    const m = cmd.match(/(\S+\.sh)\b/);
    if (m) {
      const base = m[1].split("/").pop();
      if (base && !map.has(base)) map.set(base, schedule);
    }
  }
  return map;
}

/** List the *.sh files under the scripts dir, with schedule + last-run hints. */
export async function listScriptFiles(): Promise<ScriptFile[]> {
  const dir = getChScriptsDir();
  if (!existsSync(dir)) return [];
  const schedules = parseScheduleMap(await readHostCrontab());
  const files = readdirSync(dir).filter((f) => f.endsWith(".sh")).sort();
  return files.map((name) => {
    const abs = join(dir, name);
    const st = statSync(abs);
    const logFile = logPathFor(name);
    const hasLog = existsSync(logFile);
    return {
      name,
      path: abs,
      size: st.size,
      modified: st.mtime.toISOString(),
      schedule: schedules.get(name) ?? null,
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
      mkdirSync(getChHardwareLogDir(), { recursive: true });
      appendFileSync(logFile, `\n===== run ${new Date().toISOString()} =====\n`);
    } catch {
      /* logging is best-effort */
    }
    // No shell, no user args — bash executes the validated script path only.
    execFile("/bin/bash", [abs], { timeout: 10 * 60_000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
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
