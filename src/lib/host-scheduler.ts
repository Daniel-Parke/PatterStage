// ═══════════════════════════════════════════════════════════════
// host-scheduler.ts — host-script scheduling backend (Unix crontab)
// ═══════════════════════════════════════════════════════════════
// The Scripts page schedules host scripts via the system crontab (Linux +
// macOS). The route presents the schedule as crontab-format text
// (readRaw/writeRaw), so its parse/serialise/disabled logic is OS-agnostic.
//
// PatterStage targets Linux (and macOS for development); on Windows, run it
// under WSL2 (Ubuntu) — see docs/running/cross-platform.md. There is no native-Windows
// Task Scheduler backend, and that is now a REASON rather than a dead end:
// `hostSchedulerAvailability` below says so in a sentence the Scripts page
// shows, and PatterStage's own tick carries the schedule instead (T-0107,
// decision 10).

import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { exec, execSync } from "child_process";

import { isWindows, tmpDir } from "@/lib/platform";

/** Whether this host has a scheduler of its own, and what that means. */
export interface HostSchedulerAvailability {
  available: boolean;
  /** One sentence, shown to the operator verbatim. */
  reason: string;
}

/**
 * Can this host run a scheduled script without PatterStage?
 *
 * The answer changes what the Schedule modal writes: a crontab row where there
 * is a crontab, a PatterStage `schedules` row where there is not. The reason is
 * the honest trade in both directions, because "runs while PatterStage is
 * running" is a real limitation an operator should meet before they rely on it.
 */
export function hostSchedulerAvailability(): HostSchedulerAvailability {
  if (isWindows) {
    return {
      available: false,
      reason:
        "No host scheduler on native Windows. PatterStage runs script schedules itself, while PatterStage is running.",
    };
  }
  return {
    available: true,
    reason: "Host crontab. Scheduled scripts run whether PatterStage is up or not.",
  };
}

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
      // `new Error().message` is "", and a thrown non-Error coerces to no
      // message at all. serverErrorFromHelperResult passes an empty error
      // through verbatim by design, so suppressing it is this producer's job:
      // without the guard, a message-less crontab failure reached the operator
      // as a 500 with an empty body.
      return { ok: false, error: (e as Error)?.message || "crontab write failed" };
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
