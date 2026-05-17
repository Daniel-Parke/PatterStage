/** @jest-environment node */
import {
  crontabLineUsesScriptsDir,
  expandHomeInString,
  HARDWARE_CRON_PRESET_SCRIPT_FILES,
  HARDWARE_CRON_UI_PRESETS,
  normalizeHardwareCronPath,
} from "@/lib/hardware-cron";

describe("system-cron path helpers", () => {
  const scriptsDir = "/home/zoe/control-hub/data/scripts";

  it("crontabLineUsesScriptsDir is true when expanded line contains scripts dir + file", () => {
    const line = `*/5 * * * * ${scriptsDir}/ch-watchdog.sh >> /tmp/x.log 2>&1`;
    expect(crontabLineUsesScriptsDir(line, scriptsDir)).toBe(true);
  });

  it("crontabLineUsesScriptsDir resolves $HOME and matches", () => {
    const prev = process.env.HOME;
    process.env.HOME = "/home/zoe";
    try {
      const line =
        "*/5 * * * * $HOME/control-hub/data/scripts/ch-watchdog.sh >> /tmp/x.log 2>&1";
      expect(crontabLineUsesScriptsDir(line, "/home/zoe/control-hub/data/scripts")).toBe(true);
    } finally {
      process.env.HOME = prev;
    }
  });

  it("crontabLineUsesScriptsDir is false for ~/.hermes/scripts paths", () => {
    const line =
      "*/5 * * * * /home/zoe/.hermes/scripts/ch-watchdog.sh >> /tmp/x.log 2>&1";
    expect(crontabLineUsesScriptsDir(line, scriptsDir)).toBe(false);
  });

  it("crontabLineUsesScriptsDir is false for unrelated commands", () => {
    expect(crontabLineUsesScriptsDir("*/5 * * * * /usr/bin/true", scriptsDir)).toBe(false);
  });

  it("accepts POST-style command string (script path only)", () => {
    const cmd = `${scriptsDir}/ch-watchdog.sh`;
    expect(crontabLineUsesScriptsDir(cmd, scriptsDir)).toBe(true);
  });

  it("rejects POST-style command outside scripts dir", () => {
    expect(crontabLineUsesScriptsDir("/home/zoe/.hermes/scripts/ch-watchdog.sh", scriptsDir)).toBe(
      false,
    );
  });

  it("HARDWARE_CRON_PRESET_SCRIPT_FILES matches UI preset count", () => {
    expect(HARDWARE_CRON_PRESET_SCRIPT_FILES.length).toBe(HARDWARE_CRON_UI_PRESETS.length);
  });

  it("normalizeSystemCronPath trims trailing slashes", () => {
    expect(normalizeHardwareCronPath("/a/b/c/")).toBe("/a/b/c");
  });

  it("expandHomeInString replaces $HOME", () => {
    const prev = process.env.HOME;
    process.env.HOME = "/home/test";
    try {
      expect(expandHomeInString("$HOME/foo")).toBe("/home/test/foo");
    } finally {
      process.env.HOME = prev;
    }
  });
});
