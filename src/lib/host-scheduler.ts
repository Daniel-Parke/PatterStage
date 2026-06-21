// ═══════════════════════════════════════════════════════════════
// host-scheduler.ts — cross-platform host-script scheduling backend
// ═══════════════════════════════════════════════════════════════
// The Scripts page schedules host scripts. On Unix that's the system crontab;
// on Windows it's Task Scheduler (schtasks). Both are presented to the route as
// the same crontab-format text (readRaw/writeRaw), so the route's parse/
// serialise/disabled logic is unchanged — only the OS backend swaps here.

import { writeFileSync, unlinkSync, mkdirSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { exec, execSync, execFileSync } from "child_process";

import { isWindows, tmpDir, interpreterFor } from "@/lib/platform";
import { cronToSchtasks } from "@/lib/cron-to-schtasks";
import { crontabLineUsesScriptsDir } from "@/lib/hardware-cron";
import { getPsScriptsDir, PS_DATA_DIR } from "@/lib/paths";

export interface HostScheduler {
  /** The managed schedule as crontab-format text (one job per line). */
  readRaw(): Promise<string>;
  /** Persist the managed schedule from crontab-format text. */
  writeRaw(content: string): Promise<{ ok: boolean; error?: string }>;
  /** Enable/disable a job by id. No-op on Unix (the route's JSON tracks it). */
  setEnabled(id: string, enabled: boolean): Promise<void>;
}

// ── Unix: system crontab ────────────────────────────────────────

class CrontabScheduler implements HostScheduler {
  readRaw(): Promise<string> {
    return new Promise((resolve) => {
      exec("crontab -l", { encoding: "utf-8" }, (err, out) => resolve(err ? "" : String(out)));
    });
  }
  async writeRaw(content: string): Promise<{ ok: boolean; error?: string }> {
    const tmp = join(tmpDir(), `ps-crontab-${Date.now()}.txt`);
    try {
      writeFileSync(tmp, content + "\n", { mode: 0o600 });
      execSync(`crontab ${tmp}`, { encoding: "utf-8" });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    } finally {
      try {
        unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  }
  async setEnabled(): Promise<void> {
    /* Unix: enabled state lives in the route's disabled-ids JSON. */
  }
}

// ── Windows: Task Scheduler (schtasks) ──────────────────────────

const TASK_PREFIX = "PatterStage";
const SIDE_CAR = () => join(PS_DATA_DIR, ".schtasks-cron.json");
const LAUNCHER_DIR = () => join(getPsScriptsDir(), ".schtasks");

interface SideJob {
  id: string;
  name: string;
  schedule: string;
  command: string;
  logFile: string;
}

function readSidecar(): Record<string, SideJob> {
  try {
    return JSON.parse(readFileSync(SIDE_CAR(), "utf-8")) as Record<string, SideJob>;
  } catch {
    return {};
  }
}
function writeSidecar(jobs: Record<string, SideJob>): void {
  try {
    mkdirSync(PS_DATA_DIR, { recursive: true });
    writeFileSync(SIDE_CAR(), JSON.stringify(jobs, null, 2));
  } catch {
    /* best-effort */
  }
}

/** Parse a managed crontab line → its parts (schedule, command, log, id). */
function parseManaged(line: string): Omit<SideJob, "name"> | null {
  const t = line.trim();
  if (!t || t.startsWith("#")) return null;
  if (!crontabLineUsesScriptsDir(t, getPsScriptsDir())) return null;
  const parts = t.split(/\s+/);
  if (parts.length < 6) return null;
  const schedule = parts.slice(0, 5).join(" ");
  const full = parts.slice(5).join(" ");
  const logMatch = full.match(/>>\s*(\S+\.log)\s*2>/);
  const logFile = logMatch ? logMatch[1] : "";
  const command = full.replace(/>>\s*\S+\.log\s*2>.*$/, "").trim();
  const scriptMatch = command.match(/(\S+[/\\][^/\\\s]+\.(?:mjs|cjs|js|sh|ps1|bat|cmd))\b/i);
  const scriptPath = scriptMatch ? scriptMatch[1] : "";
  const base = scriptPath.split(/[/\\]/).pop() || "";
  const id = base.replace(/\.[^.]+$/, "") || command.split(/\s+/)[0]?.split(/[/\\]/).pop() || "unknown";
  return { id, schedule, command, logFile };
}

function scriptPathFromCommand(command: string): string | null {
  const m = command.match(/(\S+[/\\][^/\\\s]+\.(?:mjs|cjs|js|sh|ps1|bat|cmd))\b/i);
  return m ? m[1] : null;
}

class SchtasksScheduler implements HostScheduler {
  async readRaw(): Promise<string> {
    const jobs = readSidecar();
    return Object.values(jobs)
      .map((j) => {
        const redirect = j.logFile ? ` >> ${j.logFile} 2>&1` : "";
        const name = j.name ? `# ${j.name}\n` : "";
        return `${name}${j.schedule} ${j.command}${redirect}`;
      })
      .join("\n");
  }

  async writeRaw(content: string): Promise<{ ok: boolean; error?: string }> {
    // Desired managed set from the crontab-format text the route produced.
    const desired = new Map<string, SideJob>();
    const lines = content.split("\n");
    let pendingName = "";
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith("#")) {
        pendingName = t.replace(/^#\s*/, "");
        continue;
      }
      const parsed = parseManaged(line);
      if (parsed) {
        desired.set(parsed.id, { ...parsed, name: pendingName });
      }
      pendingName = "";
    }

    const current = readSidecar();
    try {
      // Remove tasks no longer desired.
      for (const id of Object.keys(current)) {
        if (!desired.has(id)) this.deleteTask(id);
      }
      // Create/update desired tasks.
      for (const job of desired.values()) {
        const r = this.createTask(job);
        if (!r.ok) return r;
      }
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
    writeSidecar(Object.fromEntries(desired));
    return { ok: true };
  }

  private taskName(id: string): string {
    return `${TASK_PREFIX}\\${id}`;
  }

  /** Write a launcher .cmd that runs the script with redirection, sidestepping
   *  schtasks /TR nested-quote hell. Returns its path. */
  private writeLauncher(job: SideJob): string {
    const scriptPath = scriptPathFromCommand(job.command);
    if (!scriptPath) throw new Error(`No runnable script in command: ${job.command}`);
    const interp = interpreterFor(scriptPath);
    if (!interp) throw new Error(`No interpreter for ${scriptPath} on this platform`);
    mkdirSync(LAUNCHER_DIR(), { recursive: true });
    const launcher = join(LAUNCHER_DIR(), `${job.id}.cmd`);
    const argv = [interp.cmd, ...interp.args].map((a) => `"${a}"`).join(" ");
    const redirect = job.logFile ? ` >> "${job.logFile}" 2>&1` : "";
    writeFileSync(launcher, `@echo off\r\n${argv}${redirect}\r\n`);
    return launcher;
  }

  private createTask(job: SideJob): { ok: boolean; error?: string } {
    const sched = cronToSchtasks(job.schedule);
    if (!sched.ok) return { ok: false, error: sched.error };
    const launcher = this.writeLauncher(job);
    try {
      execFileSync(
        "schtasks",
        ["/Create", "/F", "/TN", this.taskName(job.id), "/TR", launcher, ...sched.args],
        { stdio: "ignore" },
      );
      return { ok: true };
    } catch (e) {
      return { ok: false, error: `schtasks create failed: ${(e as Error).message}` };
    }
  }

  private deleteTask(id: string): void {
    try {
      execFileSync("schtasks", ["/Delete", "/F", "/TN", this.taskName(id)], { stdio: "ignore" });
    } catch {
      /* already gone */
    }
    try {
      rmSync(join(LAUNCHER_DIR(), `${id}.cmd`), { force: true });
    } catch {
      /* ignore */
    }
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    try {
      execFileSync(
        "schtasks",
        ["/Change", "/TN", this.taskName(id), enabled ? "/ENABLE" : "/DISABLE"],
        { stdio: "ignore" },
      );
    } catch {
      /* task may not exist yet */
    }
  }
}

let cached: HostScheduler | null = null;
export function getHostScheduler(): HostScheduler {
  if (!cached) cached = isWindows ? new SchtasksScheduler() : new CrontabScheduler();
  return cached;
}
