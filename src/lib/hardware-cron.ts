/**
 * Hardware cron — path checks for crontab lines and API commands.
 * Scripts must live under getChScriptsDir() (see paths.ts).
 */

/**
 * UI labels + filenames for hardware cron presets.
 * Ship matching files under `scripts/hardware/` (`scripts/bootstrap/setup.sh` copies into CH_DATA_DIR/scripts).
 */
export const HARDWARE_CRON_UI_PRESETS = [{ label: "Backup", file: "ps-backup.sh" }] as const;

/** Filenames only (single source of truth with HARDWARE_CRON_UI_PRESETS). */
export const HARDWARE_CRON_PRESET_SCRIPT_FILES: readonly string[] =
  HARDWARE_CRON_UI_PRESETS.map((p) => p.file);

export function expandHomeInString(value: string): string {
  const home = process.env.HOME || "";
  return value.replace(/\$HOME\b/g, home).replace(/\$\{HOME\}/g, home);
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
