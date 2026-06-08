// ═══════════════════════════════════════════════════════════════
// update-api.test.ts — /api/update GET/POST behaviour
// ═══════════════════════════════════════════════════════════════

/** @jest-environment node */

const mockExecSync = jest.fn();
const mockExecFileSync = jest.fn();
const mockSpawn = jest.fn();

jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => {
      const status = init?.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(data),
      };
    },
  },
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: jest.fn(),
}));

jest.mock("child_process", () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => ""),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

let deployApiEnabled = true;
let readOnlyGate: { status: number; json: () => Promise<unknown> } | null = null;

jest.mock("@/lib/api-auth", () => ({
  getCorrelationId: () => "cid-test",
  requireAuth: () => readOnlyGate,
  requireDeployApiEnabled: () =>
    deployApiEnabled
      ? null
      : { status: 403, json: () => Promise.resolve({ error: "off" }) },
  requireSignedRequest: () => null,
}));

const mockReadDeployStatus = jest.fn();
const mockIsDeployInProgress = jest.fn();
const mockWriteDeployStatusRunning = jest.fn();
const mockTailLogHint = jest.fn();

jest.mock("@/lib/deploy-status", () => ({
  readDeployStatus: () => mockReadDeployStatus(),
  isDeployInProgress: () => mockIsDeployInProgress(),
  writeDeployStatusRunning: (...args: unknown[]) =>
    mockWriteDeployStatusRunning(...args),
  tailLogHint: (...args: unknown[]) => mockTailLogHint(...args),
}));

function getReq(url: string): { url: string } {
  return { url };
}

describe("GET /api/update", () => {
  beforeEach(() => {
    mockExecSync.mockReset();
    mockExecFileSync.mockReset();
    mockSpawn.mockReset();
    mockExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd !== "string") throw new Error("not a string");
      if (cmd.includes("git fetch")) return ""; // success, no output
      if (cmd.includes("git branch -r")) return "origin/main\norigin/dev\norigin/HEAD\norigin/feature_x\n";
      if (cmd.includes("git branch --format")) return "main\ndev\nfeature_x\n";
      if (cmd.includes("git ls-remote")) return ""; // found on remote, UPDATE_BRANCH will be added
      throw new Error("unexpected execSync: " + cmd);
    });
    mockExecFileSync.mockImplementation((cmd: string, args: string[]) => {
      if (cmd !== "git") return "";
      const sub = args[0];
      if (sub === "fetch") return "";
      if (sub === "rev-parse" && args.includes("--abbrev-ref")) return "dev";
      if (sub === "rev-parse" && args.some((a) => String(a).startsWith("origin/")))
        return "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      if (sub === "rev-parse" && args.includes("HEAD")) return "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      if (sub === "log") return "msg";
      if (sub === "rev-list") return "0";
      if (sub === "branch" && args.includes("-r")) {
        // Remote branches — all three are also local in this test
        return "origin/main\norigin/dev\norigin/HEAD\norigin/feature_x\n";
      }
      if (sub === "branch") {
        // Local branches
        return "main\ndev\nfeature_x\n";
      }
      return "";
    });
  });

  it("returns branches=1 with sanitized remote list", async () => {
    const { GET } = await import("@/app/api/update/route");
    const res = await GET(getReq("http://localhost/api/update?branches=1") as never);
    const body = await res.json();
    expect(res.ok).toBe(true);
    expect(body.data.branches).toContain("main");
    expect(body.data.branches).toContain("dev");
    expect(body.data.branches).toContain("feature_x");
  });

  it("GET check maps branch to checkout and comparedBranch", async () => {
    const { GET } = await import("@/app/api/update/route");
    const res = await GET(getReq("http://localhost/api/update?branch=dev") as never);
    const body = await res.json();
    expect(res.ok).toBe(true);
    expect(body.data.branch).toBe("dev");
    expect(body.data.comparedBranch).toBe("dev");
    expect(body.data.checkoutBranch).toBe("dev");
  });

  it("GET ?deploy=1 returns deploy status", async () => {
    mockReadDeployStatus.mockReturnValue({
      state: "running",
      action: "rebuild",
      phase: "build",
      message: "Building production bundle…",
      startedAt: "2026-05-19T12:00:00.000Z",
      finishedAt: "",
      exitCode: "",
      logHint: "ch-build.log",
    });
    mockTailLogHint.mockReturnValue([]);
    const { GET } = await import("@/app/api/update/route");
    const res = await GET(getReq("http://localhost/api/update?deploy=1") as never);
    const body = await res.json();
    expect(res.ok).toBe(true);
    expect(body.data.deploy.state).toBe("running");
    expect(body.data.deploy.action).toBe("rebuild");
    expect(body.data.deploy.logTail).toEqual([]);
  });

  it("GET ?deploy=1 includes log tail on failure", async () => {
    mockReadDeployStatus.mockReturnValue({
      state: "failed",
      action: "rebuild",
      phase: "build",
      message: "Build failed",
      startedAt: "",
      finishedAt: "",
      exitCode: "1",
      logHint: "ch-build.log",
    });
    mockTailLogHint.mockReturnValue(["npm ERR! build failed"]);
    const { GET } = await import("@/app/api/update/route");
    const res = await GET(getReq("http://localhost/api/update?deploy=1") as never);
    const body = await res.json();
    expect(body.data.deploy.logTail).toContain("npm ERR! build failed");
    expect(mockTailLogHint).toHaveBeenCalledWith("ch-build.log");
  });
});

function mockGitForDeploy(
  execFileSyncImpl: typeof mockExecFileSync,
): void {
  execFileSyncImpl.mockImplementation((cmd: string, args: string[]) => {
    if (cmd === "bash" && args[0] === "-n") return undefined as unknown as string;
    if (cmd === "git") {
      const [a0, ...rest] = args;
      if (a0 === "fetch") return "";
      if (a0 === "rev-parse") {
        const originRef = rest.find((x) => String(x).startsWith("origin/"));
        if (originRef === "origin/bad-branch") {
          throw new Error("unknown revision");
        }
        if (typeof originRef === "string" && originRef.startsWith("origin/")) {
          return "a".repeat(40);
        }
        if (rest.includes("--abbrev-ref")) return "dev";
        if (rest.includes("HEAD")) return "a".repeat(40);
      }
      if (a0 === "log") return "msg";
      if (a0 === "rev-list") return "0";
    }
    return "";
  });
}

describe("POST /api/update", () => {
  beforeEach(() => {
    mockExecSync.mockReset();
    mockExecFileSync.mockReset();
    mockSpawn.mockReset();
    mockReadDeployStatus.mockReset();
    mockIsDeployInProgress.mockReset();
    mockWriteDeployStatusRunning.mockReset();
    mockTailLogHint.mockReset();
    deployApiEnabled = true;
    readOnlyGate = null;
    mockIsDeployInProgress.mockReturnValue(false);
    mockGitForDeploy(mockExecFileSync);
    mockSpawn.mockReturnValue({ pid: 4242, unref: jest.fn() });
  });

  function postReq(body: Record<string, unknown>) {
    return {
      url: "http://localhost/api/update",
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => body,
    } as never;
  }

  it("returns 403 when deploy API disabled", async () => {
    deployApiEnabled = false;
    const { POST } = await import("@/app/api/update/route");
    const res = await POST(postReq({ action: "restart" }));
    expect(res.status).toBe(403);
  });

  it("returns 503 when read-only", async () => {
    readOnlyGate = {
      status: 503,
      json: () => Promise.resolve({ error: "read only" }),
    };
    const { POST } = await import("@/app/api/update/route");
    const res = await POST(postReq({ action: "restart" }));
    expect(res.status).toBe(503);
  });

  it("returns 500 when spawn yields no pid", async () => {
    mockSpawn.mockReturnValue({ pid: undefined, unref: jest.fn() });
    const { POST } = await import("@/app/api/update/route");
    const res = await POST(postReq({ action: "restart" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toMatch(/systemd-run|nohup|bash/i);
  });

  it("returns 400 for unknown action", async () => {
    const { POST } = await import("@/app/api/update/route");
    const res = await POST(postReq({ action: "nope" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when update branch missing on origin", async () => {
    const { POST } = await import("@/app/api/update/route");
    const res = await POST(postReq({ action: "update", branch: "bad-branch" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error)).toContain("origin");
  });

  it("returns 409 when deploy already in progress", async () => {
    mockIsDeployInProgress.mockReturnValue(true);
    const { POST } = await import("@/app/api/update/route");
    const res = await POST(postReq({ action: "rebuild" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(String(body.error)).toMatch(/in progress/i);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it("POST rebuild spawns without --branch when branch omitted", async () => {
    const { POST } = await import("@/app/api/update/route");
    const res = await POST(postReq({ action: "rebuild" }));
    expect(res.status).toBe(200);
    expect(mockWriteDeployStatusRunning).toHaveBeenCalledWith(
      "rebuild",
      "build",
      expect.stringMatching(/queued/i),
    );
    const spawnArgs = mockSpawn.mock.calls[0];
    const flat = JSON.stringify(spawnArgs);
    expect(flat).toContain("rebuild");
    expect(flat).not.toContain("--branch");
  });

  it("POST rebuild includes --branch when provided", async () => {
    const { POST } = await import("@/app/api/update/route");
    const res = await POST(postReq({ action: "rebuild", branch: "dev" }));
    expect(res.status).toBe(200);
    const flat = JSON.stringify(mockSpawn.mock.calls[0]);
    expect(flat).toContain("--branch");
    expect(flat).toContain("dev");
  });

  // ── Post-spawn lock probe (silent-failure prevention) ───────────
  // These tests verify the spawn function surfaces lock contention
  // to the API caller instead of returning 200 {status:"started"}.
  // Discovered 2026-06-08: the lock could be held by a stuck background
  // process, the script would die silently, and the UI would spin
  // forever. The new probe waits up to 3s and reports the failure.

  it("returns 500 when lock is held by another process and flock never succeeds", async () => {
    // Make flock always fail (lock held) and readFileSync return a fresh
    // running status (no failed/lock phase so the secondary check doesn't
    // short-circuit). The probe will poll for 3s and then time out.
    mockExecFileSync.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === "bash" && args[0] === "-n") return undefined as unknown as string;
      if (cmd === "flock") throw new Error("would block");
      if (cmd === "git") return "";
      if (cmd === "systemctl") return "";
      return "";
    });
    // The spawn will return a valid pid, the lock probe will detect contention
    const { POST } = await import("@/app/api/update/route");
    const res = await POST(postReq({ action: "rebuild" }));
    // The 3s lock probe times out → returns 500 with diagnostic error
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toMatch(/lock|did not acquire/i);
  }, 10000);

  it("returns 200 when flock succeeds immediately (lock is free)", async () => {
    mockExecFileSync.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === "bash" && args[0] === "-n") return undefined as unknown as string;
      if (cmd === "flock") return ""; // acquired immediately
      if (cmd === "git") return "";
      if (cmd === "systemctl") return "";
      return "";
    });
    const { POST } = await import("@/app/api/update/route");
    const res = await POST(postReq({ action: "rebuild" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.action).toBe("rebuild");
    expect(body.data.status).toBe("started");
  });

  it("returns 500 immediately when status file shows state=failed phase=lock", async () => {
    // First flock fails (lock held) but readFileSync returns a status
    // showing the script already wrote state=failed phase=lock. The probe
    // should surface that immediately without waiting the full 3s.
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "bash") return undefined as unknown as string;
      if (cmd === "flock") throw new Error("would block");
      if (cmd === "git") return "";
      if (cmd === "systemctl") return "";
      return "";
    });
    // Override the fs mock for this test to return a failed status
    const fs = await import("fs");
    (fs.readFileSync as jest.Mock).mockImplementation((p: string) => {
      if (String(p).includes("ch-deploy.status")) {
        return "state=failed\nphase=lock\naction=rebuild\nmessage=Deploy already in progress\n";
      }
      return "";
    });
    const { POST } = await import("@/app/api/update/route");
    const res = await POST(postReq({ action: "rebuild" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toMatch(/lock held|already in progress/i);
  }, 10000);
});
