/** @jest-environment node */
/**
 * System cron API — mocks crontab (`execSync`) and selective `fs` calls so CI works
 * without a real user crontab (Windows-safe).
 */

const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockUnlinkSync = jest.fn();

jest.mock("fs", () => ({
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args),
}));

const mockExecSync = jest.fn();

jest.mock("child_process", () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

jest.mock("@/lib/paths", () => ({
  CH_DATA_DIR: "/tmp/ch-data",
  PATHS: {
    controlHubDb: "/tmp/ch-data/control-hub.db",
    missions: "/tmp/ch-data/missions",
    templates: "/tmp/ch-data/templates",
    stories: "/tmp/ch-data/stories",
    recroom: "/tmp/ch-data/recroom",
    workspaces: "/tmp/ch-data/workspaces",
    teams: "/tmp/ch-data/teams",
    auditLog: "/tmp/ch-data/audit",
    chScripts: "/tmp/ch-data/scripts",
    chHardwareLogs: "/tmp/ch-data/logs",
  },
  getChScriptsDir: () => "/tmp/ch-data/scripts",
  getChHardwareLogDir: () => "/tmp/ch-data/logs",
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

import { mockRequest } from "../helpers/api-test-helpers";

describe("GET /api/cron/hardware/meta", () => {
  it("returns scriptsDir and logDir from mocked paths", async () => {
    const { GET } = await import("@/app/api/cron/hardware/meta/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data?: { scriptsDir: string; logDir: string };
    };
    expect(body.data?.scriptsDir).toBe("/tmp/ch-data/scripts");
    expect(body.data?.logDir).toBe("/tmp/ch-data/logs");
  });
});

describe("GET /api/cron/hardware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadFileSync.mockImplementation(() => {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });
  });

  it("returns jobs whose commands run scripts under getChScriptsDir()", async () => {
    mockExecSync.mockImplementation((cmd: unknown) => {
      if (String(cmd).includes("crontab -l")) {
        return [
          "*/10 * * * * /tmp/ch-data/scripts/ch-watchdog.sh >> /tmp/ch-data/logs/ch-watchdog.log 2>&1",
          "",
        ].join("\n");
      }
      return "";
    });

    const { GET } = await import("@/app/api/cron/hardware/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data?: { jobs: Array<{ id: string; name: string }>; total: number };
    };
    expect(body.data?.total).toBe(1);
    expect(body.data?.jobs[0]?.id).toBe("ch-watchdog");
    expect(body.data?.jobs[0]?.name).toContain("Watchdog");
  });

  it("returns no jobs for crontab lines outside scripts dir", async () => {
    mockExecSync.mockImplementation((cmd: unknown) => {
      if (String(cmd).includes("crontab -l")) {
        return [
          "*/10 * * * * /home/user/.hermes/scripts/ch-watchdog.sh >> /tmp/x.log 2>&1",
          "",
        ].join("\n");
      }
      return "";
    });

    const { GET } = await import("@/app/api/cron/hardware/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data?: { jobs: unknown[]; total: number } };
    expect(body.data?.total).toBe(0);
    expect(body.data?.jobs).toEqual([]);
  });
});

describe("POST /api/cron/hardware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadFileSync.mockImplementation(() => {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });
    mockExecSync.mockImplementation((cmd: unknown) => {
      const s = String(cmd);
      if (s.includes("crontab -l")) return "\n";
      if (/^crontab\s/.test(s) || s.startsWith("crontab ")) return "";
      return "";
    });
  });

  it("returns 400 when command is not under scripts directory", async () => {
    const { POST } = await import("@/app/api/cron/hardware/route");
    const req = mockRequest("http://127.0.0.1/api/cron/hardware", "POST", {
      schedule: "*/5 * * * *",
      command: "/home/user/.hermes/scripts/ch-watchdog.sh",
      name: "Bad path",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/scripts/i);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("returns 200 and writes crontab file when command is under scripts directory", async () => {
    const { POST } = await import("@/app/api/cron/hardware/route");
    const req = mockRequest("http://127.0.0.1/api/cron/hardware", "POST", {
      schedule: "*/5 * * * *",
      command: "/tmp/ch-data/scripts/ch-watchdog.sh",
      name: "Watchdog",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data?: { id: string } };
    expect(body.data?.id).toBe("ch-watchdog");

    const crontabWrite = mockWriteFileSync.mock.calls.find((call) =>
      String(call[0]).includes("ch-crontab"),
    );
    expect(crontabWrite).toBeDefined();
    expect(String(crontabWrite?.[1])).toContain("/tmp/ch-data/scripts/ch-watchdog.sh");
    expect(mockExecSync).toHaveBeenCalled();
  });

  it("pauseAll returns success without requiring script paths", async () => {
    mockExecSync.mockImplementation((cmd: unknown) => {
      if (String(cmd).includes("crontab -l")) {
        return "*/5 * * * * /tmp/ch-data/scripts/ch-health.sh >> /tmp/ch-data/logs/ch-health.log 2>&1\n";
      }
      return "";
    });

    const { POST } = await import("@/app/api/cron/hardware/route");
    const req = mockRequest("http://127.0.0.1/api/cron/hardware", "POST", {
      action: "pauseAll",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data?: { pausedCount?: number } };
    expect(body.data?.pausedCount).toBe(1);
    expect(mockWriteFileSync).toHaveBeenCalled();
  });
});
