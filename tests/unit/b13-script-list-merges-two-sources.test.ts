/** @jest-environment node */

// ═══════════════════════════════════════════════════════════════
// B13 sweep answer, the other half: `listScriptFiles` merging the host crontab
// with PatterStage's own schedule rows.
//
// Every case that reached this function stubbed `listScriptSchedules` to an
// empty list, so the merge itself was never asked a question. A version that
// let a PatterStage row shadow a crontab one, that labelled every schedule
// "host", or that dropped the row id the Unschedule button needs, passed the
// whole suite.
//
// It also pins two things about the crontab parser that only show with more
// than one line: the FIRST line for a script wins, and the redirect target
// beside the script is not mistaken for the script.
// ═══════════════════════════════════════════════════════════════

jest.mock("@/lib/paths", () => ({
  getPsScriptsDir: () => "/data/scripts",
  getPsHardwareLogDir: () => "/data/logs",
}));

const FILES = ["host-only.mjs", "ours-only.sh", "both.mjs", "unscheduled.cjs"];

jest.mock("fs", () => ({
  readdirSync: () => FILES,
  statSync: () => ({ size: 10, mtime: new Date("2026-09-01T00:00:00.000Z") }),
  existsSync: (p: string) => !String(p).endsWith(".log"),
  readFileSync: jest.fn(),
  appendFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  chmodSync: jest.fn(),
}));

const CRONTAB = [
  "# Host only. The bare `hook.cjs` before the script is the point: it ends in",
  "# a script extension and has no directory, and the parser must skip it.",
  "0 1 * * * /usr/bin/node --require hook.cjs '/data/scripts/host-only.mjs' >> /data/logs/host-only.log 2>&1",
  "# Both — the host's line, which must win",
  "0 2 * * * /usr/bin/node '/data/scripts/both.mjs' >> /data/logs/both.log 2>&1",
  "# Both again, later. The first line is the one that counts.",
  "0 9 * * * /usr/bin/node '/data/scripts/both.mjs' >> /data/logs/both.log 2>&1",
  "",
].join("\n");

jest.mock("@/lib/host-scheduler", () => ({
  getHostScheduler: () => ({
    readRaw: async () => CRONTAB,
    writeRaw: async () => ({ ok: true }),
    setEnabled: async () => undefined,
  }),
  hostSchedulerAvailability: () => ({ available: false, reason: "no crontab here" }),
}));

jest.mock("@/lib/platform", () => ({
  isWindows: true,
  isMac: false,
  isLinux: false,
  tmpDir: () => "/tmp",
  homeDir: () => "/home/op",
  interpreterFor: (abs: string) => ({ cmd: "/usr/bin/node", args: [abs] }),
}));

const listScriptSchedules = jest.fn();
jest.mock("@/lib/schedules-repository", () => ({
  listScriptSchedules: () => listScriptSchedules(),
}));

import { listScriptFiles, type ScriptFile } from "@/lib/scripts-manager";

function ownRow(id: string, scriptName: string, schedule: string) {
  return { id, kind: "script" as const, scriptName, schedule, missionId: null };
}

async function rows(): Promise<Record<string, ScriptFile>> {
  const out: Record<string, ScriptFile> = {};
  for (const f of await listScriptFiles()) out[f.name] = f;
  return out;
}

beforeEach(() => {
  jest.clearAllMocks();
  listScriptSchedules.mockReturnValue([
    ownRow("sch-ours", "ours-only.sh", "0 4 * * *"),
    // A row for a script the host ALSO schedules. This is the case the
    // contract calls out as possible and decides in the host's favour: an
    // operator who moved from WSL2 to a native install can hold both.
    ownRow("sch-shadow", "both.mjs", "0 8 * * *"),
  ]);
});

describe("listScriptFiles merges the two places a schedule can live", () => {
  it("labels a host-crontab row as the host's, with no row id", async () => {
    const r = (await rows())["host-only.mjs"];
    expect(r.schedule).toBe("0 1 * * *");
    expect(r.scheduleSource).toBe("host");
    expect(r.scheduleId).toBeNull();
  });

  it("labels a PatterStage row as ours, and carries the id Unschedule needs", async () => {
    const r = (await rows())["ours-only.sh"];
    expect(r.schedule).toBe("0 4 * * *");
    expect(r.scheduleSource).toBe("patterstage");
    // Without this the row's Unschedule button falls back to the crontab and
    // deletes nothing, silently.
    expect(r.scheduleId).toBe("sch-ours");
  });

  it("lets the host win where both hold a row for the same script", async () => {
    const r = (await rows())["both.mjs"];
    expect(r.schedule).toBe("0 2 * * *");
    expect(r.scheduleSource).toBe("host");
    expect(r.scheduleId).toBeNull();
  });

  it("says nothing about a script neither of them schedules", async () => {
    const r = (await rows())["unscheduled.cjs"];
    expect(r.schedule).toBeNull();
    expect(r.scheduleSource).toBeNull();
    expect(r.scheduleId).toBeNull();
  });

  it("keeps the FIRST crontab line for a script, not the last", async () => {
    // Two lines name both.mjs; the map is built once and the earlier line is
    // the one the cron layer treats as the job.
    expect((await rows())["both.mjs"].schedule).toBe("0 2 * * *");
  });

  it("still lists every file when the database cannot be read", async () => {
    listScriptSchedules.mockImplementation(() => {
      throw new Error("no such table: schedules");
    });
    const r = await rows();
    // This route must answer before the database has been bootstrapped, so a
    // failed read costs the PatterStage rows and nothing else.
    expect(Object.keys(r).sort()).toEqual([...FILES].sort());
    expect(r["host-only.mjs"].scheduleSource).toBe("host");
    expect(r["ours-only.sh"].scheduleSource).toBeNull();
  });
});
