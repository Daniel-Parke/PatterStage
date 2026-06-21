// ═══════════════════════════════════════════════════════════════
// host-scheduler.ts — host-script scheduling backend (Unix crontab)
// ═══════════════════════════════════════════════════════════════
// The Scripts page schedules host scripts via the system crontab (Linux +
// macOS). The route presents the schedule as crontab-format text
// (readRaw/writeRaw), so its parse/serialise/disabled logic is OS-agnostic.
//
// PatterStage targets Linux (and macOS for development); on Windows, run it
// under WSL2 (Ubuntu) — see docs/CROSS_PLATFORM.md. There is no native-Windows
// Task Scheduler backend.

import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { exec, execSync } from "child_process";

import { tmpDir } from "@/lib/platform";

export interface HostScheduler {
  /** The managed schedule as crontab-format text (one job per line). */
  readRaw(): Promise<string>;
  /** Persist the managed schedule from crontab-format text. */
  writeRaw(content: string): Promise<{ ok: boolean; error?: string }>;
  /** Enable/disable a job by id. No-op here (the route's JSON tracks it). */
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
    /* enabled state lives in the route's disabled-ids JSON. */
  }
}

let cached: HostScheduler | null = null;
export function getHostScheduler(): HostScheduler {
  if (!cached) cached = new CrontabScheduler();
  return cached;
}
