/** @jest-environment node */

// expandHomeInString now resolves the home dir via os.homedir() (so it matches
// how the scripts dir is resolved in paths.ts, and works on Windows where $HOME
// is not set). Mock homedir() to make the expansion deterministic.
let mockHome = "/home/zoe";
jest.mock("os", () => {
  const actual = jest.requireActual("os");
  return { ...actual, homedir: () => mockHome };
});

import {
  crontabLineUsesScriptsDir,
  expandHomeInString,
  HARDWARE_CRON_PRESET_SCRIPT_FILES,
  HARDWARE_CRON_UI_PRESETS,
  normalizeHardwareCronPath,
} from "@/lib/hardware-cron";

describe("system-cron path helpers", () => {
  const scriptsDir = "/home/zoe/patterstage/data/scripts";

  beforeEach(() => {
    mockHome = "/home/zoe";
  });

  it("crontabLineUsesScriptsDir is true when expanded line contains scripts dir + file", () => {
    const line = `*/5 * * * * ${scriptsDir}/ps-backup.sh >> /tmp/x.log 2>&1`;
    expect(crontabLineUsesScriptsDir(line, scriptsDir)).toBe(true);
  });

  it("crontabLineUsesScriptsDir resolves $HOME (from os.homedir) and matches", () => {
    mockHome = "/home/zoe";
    const line =
      "*/5 * * * * $HOME/patterstage/data/scripts/ps-backup.sh >> /tmp/x.log 2>&1";
    expect(crontabLineUsesScriptsDir(line, "/home/zoe/patterstage/data/scripts")).toBe(true);
  });

  it("crontabLineUsesScriptsDir is false for ~/.hermes/scripts paths", () => {
    const line =
      "*/5 * * * * /home/zoe/.hermes/scripts/ps-backup.sh >> /tmp/x.log 2>&1";
    expect(crontabLineUsesScriptsDir(line, scriptsDir)).toBe(false);
  });

  it("crontabLineUsesScriptsDir is false for unrelated commands", () => {
    expect(crontabLineUsesScriptsDir("*/5 * * * * /usr/bin/true", scriptsDir)).toBe(false);
  });

  it("accepts POST-style command string (script path only)", () => {
    const cmd = `${scriptsDir}/ps-backup.sh`;
    expect(crontabLineUsesScriptsDir(cmd, scriptsDir)).toBe(true);
  });

  it("rejects POST-style command outside scripts dir", () => {
    expect(crontabLineUsesScriptsDir("/home/zoe/.hermes/scripts/ps-backup.sh", scriptsDir)).toBe(
      false,
    );
  });

  it("HARDWARE_CRON_PRESET_SCRIPT_FILES matches UI preset count", () => {
    expect(HARDWARE_CRON_PRESET_SCRIPT_FILES.length).toBe(HARDWARE_CRON_UI_PRESETS.length);
  });

  it("normalizeSystemCronPath trims trailing slashes", () => {
    expect(normalizeHardwareCronPath("/a/b/c/")).toBe("/a/b/c");
  });

  it("expandHomeInString replaces $HOME / ${HOME} with os.homedir()", () => {
    mockHome = "/home/test";
    expect(expandHomeInString("$HOME/foo")).toBe("/home/test/foo");
    expect(expandHomeInString("${HOME}/bar")).toBe("/home/test/bar");
  });

  it("expandHomeInString also expands %USERPROFILE% (Windows-style)", () => {
    mockHome = "C:/Users/test";
    expect(expandHomeInString("%USERPROFILE%/foo")).toBe("C:/Users/test/foo");
  });
});
