/** @jest-environment node */

jest.mock("@/lib/hermes-agent-runtime", () => ({
  getActiveHermesPaths: () => ({ logs: "/tmp/hermes-logs-test" }),
}));

jest.mock("@/lib/api-auth", () => ({
  requireMcApiKey: () => null,
  requireNotReadOnly: () => null,
}));

const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockReaddirSync = jest.fn();
const mockStatSync = jest.fn();

jest.mock("fs", () => ({
  existsSync: (...a: unknown[]) => mockExistsSync(...a),
  readFileSync: (...a: unknown[]) => mockReadFileSync(...a),
  readdirSync: (...a: unknown[]) => mockReaddirSync(...a),
  statSync: (...a: unknown[]) => mockStatSync(...a),
}));

function setupExistsForLog(logName: string) {
  mockExistsSync.mockImplementation((p: unknown) => {
    const s = String(p).replace(/\\/g, "/");
    if (s.endsWith("hermes-logs-test")) return true;
    if (s.endsWith(`${logName}.log`)) return true;
    return false;
  });
}

describe("GET /api/logs sanitisation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 for invalid name query characters", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["agent.log"]);
    mockStatSync.mockReturnValue({ size: 10, mtime: new Date("2026-01-02") });
    mockReadFileSync.mockReturnValue("line\n");

    const { GET } = await import("@/app/api/logs/route");
    const res = await GET(
      new Request("http://localhost/api/logs?name=a%3Bb&lines=50"),
    );
    expect(res.status).toBe(400);
  });

  it("lists ch-health style names in availableLogs", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["agent.log", "ch-health.log"]);
    mockStatSync.mockReturnValue({ size: 10, mtime: new Date("2026-01-02") });
    mockReadFileSync.mockReturnValue("ok\n");

    const { GET } = await import("@/app/api/logs/route");
    const res = await GET(new Request("http://localhost/api/logs?name=agent"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const names = body.data.availableLogs.map((x: { name: string }) => x.name);
    expect(names).toContain("agent");
    expect(names).toContain("ch-health");
    const ch = body.data.availableLogs.find((x: { name: string }) => x.name === "ch-health");
      expect(ch.group).toBe("system");
  });
});

describe("GET /api/logs timestamp injection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("injects mtime-based timestamp for lines without timestamps", async () => {
    // ch-server.log contains Next.js raw output without timestamps
    setupExistsForLog("ch-server");
    mockReaddirSync.mockReturnValue(["ch-server.log"]);
    // File mtime: 2026-05-10T17:33:52.000Z
    mockStatSync.mockReturnValue({
      size: 50,
      mtime: new Date("2026-05-10T17:33:52.000Z"),
    });
    // First line has no timestamp, second line also has no timestamp
    mockReadFileSync.mockReturnValue("▲ Next.js 16.2.3\nLocal: http://127.0.0.1:42069\n");

    const { GET } = await import("@/app/api/logs/route");
    const res = await GET(
      new Request("http://localhost/api/logs?name=ch-server&lines=50"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const lines: string[] = body.data.lines;
    // Lines are reversed from the file. The "Local:" line is first (was last in file).
    // Both lines lack timestamp patterns, so both get mtime injected.
    // "Local: http://127.0.0.1:42069" reversed to front → first gets timestamp.
    const firstLine = lines[0];
    expect(firstLine).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} Local:/);
    // The Next.js line (reversed to second position) also gets timestamp.
    expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} ▲ Next\.js/);
  });

  it("does not inject timestamp for lines that already have a timestamp", async () => {
    setupExistsForLog("agent");
    mockReaddirSync.mockReturnValue(["agent.log"]);
    mockStatSync.mockReturnValue({
      size: 50,
      mtime: new Date("2026-05-10T17:33:52.000Z"),
    });
    // Already has YYYY-MM-DD HH:MM:SS,SSS timestamp format
    mockReadFileSync.mockReturnValue(
      "2026-05-10 17:33:52,123 ERROR Already has timestamp\n",
    );

    const { GET } = await import("@/app/api/logs/route");
    const res = await GET(
      new Request("http://localhost/api/logs?name=agent&lines=50"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const firstLine = body.data.lines[0];
    // Should NOT double-inject: already has YYYY-MM-DD HH:MM:SS pattern
    expect(firstLine).toBe("2026-05-10 17:33:52,123 ERROR Already has timestamp");
  });

  it("does not inject timestamp for bracket-timestamp lines like [WATCHDOG]", async () => {
    setupExistsForLog("ch-watchdog");
    mockReaddirSync.mockReturnValue(["ch-watchdog.log"]);
    mockStatSync.mockReturnValue({
      size: 50,
      mtime: new Date("2026-05-09T01:34:37.000Z"),
    });
    mockReadFileSync.mockReturnValue(
      "[2026-05-09 01:34:37] [WATCHDOG] OK: All services healthy\n",
    );

    const { GET } = await import("@/app/api/logs/route");
    const res = await GET(
      new Request("http://localhost/api/logs?name=ch-watchdog&lines=50"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const firstLine = body.data.lines[0];
    // Should keep the original bracket format, not prefix with mtime
    expect(firstLine).toBe(
      "[2026-05-09 01:34:37] [WATCHDOG] OK: All services healthy",
    );
  });
});
