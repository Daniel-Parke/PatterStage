/**
 * Hardware cron — path checks for crontab lines and API commands.
 * Scripts must live under getPsScriptsDir() (see paths.ts).
 */

import { homedir } from "os";

import { isWindows } from "@/lib/platform";

/**
 * UI labels + filenames for hardware cron presets. Ship matching files under
 * `scripts/hardware/` (setup copies them into PS_DATA_DIR/scripts). The
 * Hindsight backup is a bash + Linux service, so it's offered on Unix only;
 * the cross-platform `.mjs` utilities are always available to schedule by name.
 */
export const HARDWARE_CRON_UI_PRESETS: readonly { label: string; file: string }[] = isWindows
  ? [
      { label: "DB backup", file: "ps-db-backup.mjs" },
      { label: "Health check", file: "ps-health-check.mjs" },
      { label: "Log rotate", file: "ps-log-rotate.mjs" },
    ]
  : [{ label: "Backup", file: "ps-backup.sh" }];

/** Filenames only (single source of truth with HARDWARE_CRON_UI_PRESETS). */
export const HARDWARE_CRON_PRESET_SCRIPT_FILES: readonly string[] =
  HARDWARE_CRON_UI_PRESETS.map((p) => p.file);

export function expandHomeInString(value: string): string {
  // os.homedir() resolves USERPROFILE on Windows; $HOME is not set there.
  const home = homedir();
  return value
    .replace(/\$HOME\b/g, home)
    .replace(/\$\{HOME\}/g, home)
    .replace(/%USERPROFILE%/gi, home);
}

/** Normalise for comparison: forward slashes, no trailing slash. */
export function normalizeHardwareCronPath(p: string): string {
  let s = p.replace(/\\/g, "/").trim();
  while (s.endsWith("/")) {
    s = s.slice(0, -1);
  }
  return s;
}

/**
 * True if expanded line contains scriptsDir as a path prefix (dir boundary).
 */
export function crontabLineUsesScriptsDir(line: string, scriptsDir: string): boolean {
  const expanded = expandHomeInString(line).replace(/\\/g, "/");
  const dir = normalizeHardwareCronPath(scriptsDir);
  if (!dir) return false;
  return expanded.includes(`${dir}/`);
}
