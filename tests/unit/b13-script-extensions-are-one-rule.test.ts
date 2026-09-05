/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- the shared module this contract creates does not exist yet, so it is required where it is used: a missing file must red the tests that need it rather than the whole file at import time */

// ═══════════════════════════════════════════════════════════════
// B13 oracle, group script-extensions (T-0107; D41 blocker, D46, D47, D48).
//
// Written before the product code moved. Contract sections 1.1-1.5 and 6.
//
// THE DEFECT. The seven extensions PatterStage lists, runs and schedules are
// written out FIVE times, in four files, with three different answers:
//
//   scripts-manager.ts:38   ALLOWED_SCRIPT_EXTS, all seven  (list + run)
//   scripts-manager.ts:44   /\.(sh|mjs|cjs|js|ps1|bat|cmd)$/i  (log filename)
//   scripts-manager.ts:171  /(\S+\.sh)\b/                   (D41: the schedule map)
//   crontab-command.ts:22   SCRIPT_EXT_RE, all seven        (the crontab id)
//   crontab-command.ts:86   (?:sh|mjs|cjs|js), FOUR of them (D47: scheduling)
//   scripts/page.tsx:139    /\.sh$/                         (D48: unschedule id)
//   ScheduleScriptModal:60  /\.sh$/                         (the job label)
//
// So `ps-db-backup.mjs` — which setup.sh actually installs — can be scheduled,
// really is written to the crontab, and then shows as "not scheduled" forever
// (D41), and Unschedule sends id=ps-db-backup.mjs against an entry called
// ps-db-backup and answers 404 (D48). A .ps1 has a Schedule button that always
// refuses (D47). And a new script named backup.mjs is written to disk as
// backup.mjs.sh (D46, pinned in the page oracle).
//
// THE CONTRACT. ONE module, `src/lib/scripts/script-ext.ts`, holds the seven
// and the three regexes built from them. Nothing else in src/ writes the
// alternation, and nothing else writes /\.sh$/ at all.
//
// The doubles are the scripts dir (a fake path via @/lib/paths), the fs the
// manager reads, and the host scheduler's crontab text. The source scan uses
// jest.requireActual("fs") so the mocked fs cannot make it read nothing.
// ═══════════════════════════════════════════════════════════════

import { join } from "path";

// ── the fakes the script manager reads through ─────────────────

jest.mock("@/lib/paths", () => ({
  getPsScriptsDir: () => "/data/scripts",
  getPsHardwareLogDir: () => "/data/logs",
}));

const dirEntries = ["ps-db-backup.mjs", "legacy.sh", "notes.txt"];

jest.mock("fs", () => ({
  existsSync: jest.fn(() => true),
  readdirSync: jest.fn(() => dirEntries),
  statSync: jest.fn(() => ({ size: 128, mtime: new Date("2026-09-01T00:00:00.000Z") })),
  readFileSync: jest.fn(() => ""),
  appendFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  chmodSync: jest.fn(),
}));

const CRONTAB = [
  "# PatterStage Db Backup",
  "0 3 * * * /usr/bin/node '/data/scripts/ps-db-backup.mjs' >> /data/logs/ps-db-backup.log 2>&1",
  "# Legacy",
  "30 4 * * * /bin/bash '/data/scripts/legacy.sh' >> /data/logs/legacy.log 2>&1",
  "",
].join("\n");

jest.mock("@/lib/host-scheduler", () => ({
  getHostScheduler: () => ({
    readRaw: async () => CRONTAB,
    writeRaw: async () => ({ ok: true }),
    setEnabled: async () => undefined,
  }),
  hostSchedulerAvailability: () => ({ available: true, reason: "" }),
}));

// interpreterFor is the platform question, not the "is this a script" question.
// Fixed here so the extension assertions below mean the same thing on every OS:
// a .bat legitimately has no interpreter on Linux, and that refusal must not be
// mistaken for the "not a script" refusal D47 is about.
jest.mock("@/lib/platform", () => ({
  isWindows: false,
  isMac: false,
  isLinux: true,
  tmpDir: () => "/tmp",
  homeDir: () => "/home/op",
  interpreterFor: (abs: string) => ({ cmd: "/usr/bin/node", args: [abs] }),
}));

jest.mock("@/lib/hardware-cron", () => ({
  crontabLineUsesScriptsDir: () => true,
  expandHomeInString: (v: string) => v,
  normalizeHardwareCronPath: (p: string) => p,
  HARDWARE_CRON_UI_PRESETS: [],
  HARDWARE_CRON_PRESET_SCRIPT_FILES: [],
}));

// The PatterStage-owned script rows (contract 3.1). Empty here: this file is
// about extensions, and the fallback scheduler has an oracle of its own.
jest.mock("@/lib/schedules-repository", () => ({
  listScriptSchedules: () => [],
}));

import { listScriptFiles, type ScriptFile } from "@/lib/scripts-manager";
import { canonicaliseScriptsCommand } from "@/lib/hardware-cron-handlers/crontab-command";

// ── the module the contract creates, loaded lazily ─────────────

interface ScriptExtModule {
  SCRIPT_EXTS: readonly string[];
  SCRIPT_EXT_RE: RegExp;
  SCRIPT_PATH_RE: RegExp;
  SCRIPT_COMMAND_RE: RegExp;
  SCRIPT_EXT_LIST: string;
  hasScriptExt: (name: string) => boolean;
  stripScriptExt: (name: string) => string;
  extractScriptName: (command: string) => string;
}

function scriptExt(): ScriptExtModule {
  let mod: unknown;
  try {
    mod = require("@/lib/scripts/script-ext");
  } catch {
    throw new Error("src/lib/scripts/script-ext.ts does not exist yet (contract 1.1)");
  }
  return mod as ScriptExtModule;
}

const SEVEN = [".sh", ".mjs", ".cjs", ".js", ".ps1", ".bat", ".cmd"];

// ── the source scan, over the real filesystem ──────────────────

const realFs = jest.requireActual("fs") as typeof import("fs");
const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of realFs.readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const SOURCES = walk(SRC);

/** Repo-relative, forward-slashed, so an assertion failure names the file. */
function rel(path: string): string {
  return path.slice(process.cwd().length + 1).replace(/\\/g, "/");
}

function sourcesContaining(needle: string): string[] {
  return SOURCES.filter((f) => realFs.readFileSync(f, "utf-8").includes(needle)).map(rel);
}

// ── FUSE ────────────────────────────────────────────────────────

describe("FUSE: the doubles are doubles and the scan reads the repo", () => {
  it("resolves a fake scripts directory, never the operator's", () => {
    const { getPsScriptsDir } = require("@/lib/paths") as { getPsScriptsDir: () => string };
    expect(getPsScriptsDir()).toBe("/data/scripts");
  });

  it("walks the real src tree (guard the guard: a scan of nothing is not a pass)", () => {
    expect(SOURCES.length).toBeGreaterThan(400);
    expect(sourcesContaining("export function interpreterFor")).toEqual(["src/lib/platform.ts"]);
  });
});

// ═══════════════════════════════════════════════════════════════
// 1.1 the shared module
// ═══════════════════════════════════════════════════════════════

describe("src/lib/scripts/script-ext.ts is the one place the seven are written", () => {
  it("names the seven extensions, in the documented order", () => {
    expect([...scriptExt().SCRIPT_EXTS]).toEqual(SEVEN);
  });

  it("SCRIPT_EXT_RE matches every one of them, and nothing else", () => {
    const { SCRIPT_EXT_RE } = scriptExt();
    for (const ext of SEVEN) {
      expect(SCRIPT_EXT_RE.test(`ps-db-backup${ext}`)).toBe(true);
    }
    expect(SCRIPT_EXT_RE.test("ps-db-backup.MJS")).toBe(true);
    expect(SCRIPT_EXT_RE.test("notes.txt")).toBe(false);
    expect(SCRIPT_EXT_RE.test("ps-db-backup.log")).toBe(false);
    expect(SCRIPT_EXT_RE.test("passwd")).toBe(false);
    // The extension is TRAILING. "backup.sh.txt" is not a script.
    expect(SCRIPT_EXT_RE.test("backup.sh.txt")).toBe(false);
  });

  it("hasScriptExt and stripScriptExt agree with it for all seven", () => {
    const { hasScriptExt, stripScriptExt } = scriptExt();
    for (const ext of SEVEN) {
      expect(hasScriptExt(`ps-db-backup${ext}`)).toBe(true);
      expect(stripScriptExt(`ps-db-backup${ext}`)).toBe("ps-db-backup");
    }
    expect(hasScriptExt("notes.txt")).toBe(false);
    expect(stripScriptExt("notes.txt")).toBe("notes.txt");
  });

  it("SCRIPT_EXT_LIST is the sentence the refusals and the editor quote", () => {
    expect(scriptExt().SCRIPT_EXT_LIST).toBe(".sh, .mjs, .cjs, .js, .ps1, .bat or .cmd");
  });

  it("extractScriptName pulls the basename out of an installed crontab command", () => {
    const { extractScriptName } = scriptExt();
    expect(
      extractScriptName(
        "/usr/bin/node '/data/scripts/ps-db-backup.mjs' >> /data/logs/ps-db-backup.log 2>&1",
      ),
    ).toBe("ps-db-backup.mjs");
    expect(
      extractScriptName("powershell.exe -File 'C:\\data\\scripts\\ps-report.ps1'"),
    ).toBe("ps-report.ps1");
    // The redirected log target is not a script, and neither is an env var.
    expect(extractScriptName("KEEP=7 /bin/echo hi >> /data/logs/x.log 2>&1")).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════
// 1.2 nothing else in src/ writes the rule
// ═══════════════════════════════════════════════════════════════

describe("the alternation is written once", () => {
  it("only script-ext.ts contains the extension alternation", () => {
    expect(sourcesContaining("mjs|cjs")).toEqual(["src/lib/scripts/script-ext.ts"]);
  });

  it("no file hand-rolls a .sh-only strip", () => {
    expect(sourcesContaining("\\.sh$")).toEqual([]);
  });

  it("the second copy of the list is gone", () => {
    expect(sourcesContaining("ALLOWED_SCRIPT_EXTS")).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
// D47: .ps1 / .bat / .cmd can be scheduled
// ═══════════════════════════════════════════════════════════════

describe("canonicaliseScriptsCommand accepts every script type the page lists", () => {
  it.each(SEVEN)("accepts a bare %s basename", (ext) => {
    const result = canonicaliseScriptsCommand(`ps-report${ext}`);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scriptName).toBe(`ps-report${ext}`);
  });

  it("still refuses something that is not a script, naming all seven", async () => {
    const result = canonicaliseScriptsCommand("notes.txt");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = (await result.response.json()) as { error?: string };
      expect(body.error).toBe(
        "Command must name a script (.sh, .mjs, .cjs, .js, .ps1, .bat or .cmd) from the PatterStage scripts directory.",
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// D41 (blocker): a scheduled .mjs shows as scheduled
// ═══════════════════════════════════════════════════════════════

/** Pre-B13 shim: the two fields contract 4.1 adds to the row. */
type ScheduledScriptFile = ScriptFile & {
  scheduleSource?: "host" | "patterstage" | null;
  scheduleId?: string | null;
};

async function rowFor(name: string): Promise<ScheduledScriptFile> {
  const files = (await listScriptFiles()) as ScheduledScriptFile[];
  const row = files.find((f) => f.name === name);
  if (!row) throw new Error(`no row for ${name}; got ${files.map((f) => f.name).join(", ")}`);
  return row;
}

describe("the schedule map reads the crontab the cron layer wrote", () => {
  it("GREEN CONTROL: a .sh script still shows its schedule", async () => {
    expect((await rowFor("legacy.sh")).schedule).toBe("30 4 * * *");
  });

  it("a scheduled .mjs script shows its schedule (D41)", async () => {
    expect((await rowFor("ps-db-backup.mjs")).schedule).toBe("0 3 * * *");
  });

  it("says the schedule came from the host, so the row can label itself", async () => {
    const row = await rowFor("ps-db-backup.mjs");
    expect(row.scheduleSource).toBe("host");
    expect(row.scheduleId).toBeNull();
  });

  it("lists only script files (the .txt beside them is not one)", async () => {
    const names = (await listScriptFiles()).map((f) => f.name);
    expect(names).toEqual(["legacy.sh", "ps-db-backup.mjs"]);
  });
});

// ═══════════════════════════════════════════════════════════════
// contract 6: the gallery offers a cross-platform starter
// ═══════════════════════════════════════════════════════════════

describe("the template gallery ships .mjs starters", () => {
  interface Template {
    id: string;
    name: string;
    label: string;
    description: string;
    content: string;
  }
  function templates(): Template[] {
    const mod = require("@/components/scripts/script-templates") as {
      SCRIPT_TEMPLATES: Template[];
    };
    return mod.SCRIPT_TEMPLATES;
  }

  it("every template filename is a script filename", () => {
    const { hasScriptExt } = scriptExt();
    for (const t of templates()) expect(hasScriptExt(t.name)).toBe(true);
  });

  it("at least two templates are .mjs, each with a node shebang", () => {
    const mjs = templates().filter((t) => t.name.endsWith(".mjs"));
    expect(mjs.length).toBeGreaterThanOrEqual(2);
    for (const t of mjs) expect(t.content.startsWith("#!/usr/bin/env node")).toBe(true);
  });

  it("a cross-platform starter is one of the first two cards", () => {
    expect(templates().slice(0, 2).some((t) => t.name.endsWith(".mjs"))).toBe(true);
  });
});
