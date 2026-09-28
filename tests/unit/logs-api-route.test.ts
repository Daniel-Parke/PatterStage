/** @jest-environment node */
import type { NextRequest } from "next/server";
import { resolve } from "path";

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getActiveHermesPaths: () => ({ logs: "/tmp/hermes-logs-test" }),
}));

jest.mock("@/lib/api/api-auth", () => ({
}));

const mockExistsSync = jest.fn();
const mockReaddirSync = jest.fn();
interface MockLogFile {
  content: string;
  mtime: Date;
  dev: number;
  ino: number;
  nlink: number;
}
const mockFiles = new Map<string, MockLogFile>();
const mockDescriptors = new Map<number, MockLogFile>();
let mockNextDescriptor = 100;

function mockFileAt(path: unknown): MockLogFile {
  const file = mockFiles.get(String(path));
  if (!file) {
    const error = new Error("Mock log file not found: " + String(path)) as NodeJS.ErrnoException;
    error.code = "ENOENT";
    throw error;
  }
  return file;
}

function mockStats(file: MockLogFile, bigint = false) {
  return {
    size: bigint ? BigInt(Buffer.byteLength(file.content)) : Buffer.byteLength(file.content),
    mtime: file.mtime,
    dev: bigint ? BigInt(file.dev) : file.dev,
    ino: bigint ? BigInt(file.ino) : file.ino,
    nlink: bigint ? BigInt(file.nlink) : file.nlink,
    isFile: () => true,
    isSymbolicLink: () => false,
  };
}

const mockLstatSync = jest.fn((path: unknown, options?: { bigint?: boolean }) =>
  mockStats(mockFileAt(path), options?.bigint === true));
const mockRealpathSync = jest.fn((path: unknown) => {
  if (String(path).endsWith(".log")) mockFileAt(path);
  return String(path);
});
const mockOpenSync = jest.fn((path: unknown) => {
  const fd = mockNextDescriptor++;
  mockDescriptors.set(fd, mockFileAt(path));
  return fd;
});
const mockFstatSync = jest.fn((fd: number, options?: { bigint?: boolean }) => {
  const file = mockDescriptors.get(fd);
  if (!file) throw new Error("Mock log descriptor not found: " + fd);
  return mockStats(file, options?.bigint === true);
});
const mockReadFileSync = jest.fn((fd: number) => {
  const file = mockDescriptors.get(fd);
  if (!file) throw new Error("Mock log descriptor not found: " + fd);
  return file.content;
});
const mockReadSync = jest.fn((fd: number, buffer: Buffer, offset: number, length: number, position: number) => {
  const file = mockDescriptors.get(fd);
  if (!file) throw new Error("Mock log descriptor not found: " + fd);
  return Buffer.from(file.content).copy(buffer, offset, position, position + length);
});
const mockCloseSync = jest.fn((fd: number) => {
  mockDescriptors.delete(fd);
});

function mockRegularLog(name: string, content: string, mtime: Date): void {
  mockFiles.set(resolve("/tmp/hermes-logs-test", name + ".log"), {
    content, mtime, dev: 1, ino: mockFiles.size + 1, nlink: 1,
  });
}

jest.mock("fs", () => ({
  constants: jest.requireActual<typeof import("fs")>("fs").constants,
  existsSync: (...a: unknown[]) => mockExistsSync(...a),
  readFileSync: (fd: number) => mockReadFileSync(fd),
  readSync: (...a: Parameters<typeof mockReadSync>) => mockReadSync(...a),
  readdirSync: (...a: unknown[]) => mockReaddirSync(...a),
  statSync: (path: unknown) => mockLstatSync(path),
  lstatSync: (path: unknown, options?: { bigint?: boolean }) => mockLstatSync(path, options),
  realpathSync: (path: unknown) => mockRealpathSync(path),
  openSync: (path: unknown) => mockOpenSync(path),
  fstatSync: (...a: Parameters<typeof mockFstatSync>) => mockFstatSync(...a),
  closeSync: (...a: Parameters<typeof mockCloseSync>) => mockCloseSync(...a),
}));

beforeEach(() => {
  mockFiles.clear();
  mockDescriptors.clear();
  mockNextDescriptor = 100;
});

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
    mockRegularLog("agent", "line\n", new Date("2026-01-02"));

    const { GET } = await import("@/app/api/logs/route");
    const res = await GET(
      new Request("http://localhost/api/logs?name=a%3Bb&lines=50") as unknown as NextRequest,
    );
    expect(res.status).toBe(400);
  });

  it("lists ch-backup style names in availableLogs", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["agent.log", "ch-backup.log"]);
    mockRegularLog("agent", "ok\n", new Date("2026-01-02"));
    mockRegularLog("ch-backup", "ok\n", new Date("2026-01-02"));

    const { GET } = await import("@/app/api/logs/route");
    const res = await GET(new Request("http://localhost/api/logs?name=agent") as unknown as NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    const names = body.data.availableLogs.map((x: { name: string }) => x.name);
    expect(names).toContain("agent");
    expect(names).toContain("ch-backup");
    const ch = body.data.availableLogs.find((x: { name: string }) => x.name === "ch-backup");
      expect(ch.group).toBe("system");
  });
});

describe("GET /api/logs on a fresh install (T-0087)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("a logs directory with no files says so calmly, with noLogsYet", async () => {
    // Driving a clean isolated instance found this: the directory existed
    // (empty) so the dir-missing branch never fired, and the page showed the
    // red "Log file 'agent.log' not found" banner for a normal condition.
    mockExistsSync.mockImplementation((p: unknown) => String(p).replace(/\\/g, "/").endsWith("hermes-logs-test"));
    mockReaddirSync.mockReturnValue([]);

    const { GET } = await import("@/app/api/logs/route");
    const res = await GET(new Request("http://localhost/api/logs?name=agent") as unknown as NextRequest);
    const body = (await res.json()) as { error: string; data: { availableLogs: unknown[]; noLogsYet?: boolean } };

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/normal on a fresh install/i);
    expect(body.data.noLogsYet).toBe(true);
    expect(body.data.availableLogs).toEqual([]);
  });

  it("a missing file among OTHER files is still the plain 404 with the list", async () => {
    setupExistsForLog("gateway");
    mockReaddirSync.mockReturnValue(["gateway.log"]);
    mockRegularLog("gateway", "gateway\n", new Date("2026-01-02"));

    const { GET } = await import("@/app/api/logs/route");
    const res = await GET(new Request("http://localhost/api/logs?name=agent") as unknown as NextRequest);
    const body = (await res.json()) as { error: string; data: { noLogsYet?: boolean } };

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/agent\.log.*not found/);
    expect(body.data.noLogsYet).toBeUndefined();
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
    // First line has no timestamp, second line also has no timestamp
    mockRegularLog("ch-server", "▲ Next.js 16.2.3\nLocal: http://127.0.0.1:42069\n", new Date("2026-05-10T17:33:52.000Z"));

    const { GET } = await import("@/app/api/logs/route");
    const res = await GET(
      new Request("http://localhost/api/logs?name=ch-server&lines=50") as unknown as NextRequest,
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
    // Already has YYYY-MM-DD HH:MM:SS,SSS timestamp format
    mockRegularLog("agent",
      "2026-05-10 17:33:52,123 ERROR Already has timestamp\n",
      new Date("2026-05-10T17:33:52.000Z"),
    );

    const { GET } = await import("@/app/api/logs/route");
    const res = await GET(
      new Request("http://localhost/api/logs?name=agent&lines=50") as unknown as NextRequest,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const firstLine = body.data.lines[0];
    // Should NOT double-inject: already has YYYY-MM-DD HH:MM:SS pattern
    expect(firstLine).toBe("2026-05-10 17:33:52,123 ERROR Already has timestamp");
  });

  it("does not inject timestamp for bracket-timestamp lines like [WATCHDOG]", async () => {
    setupExistsForLog("ch-backup");
    mockReaddirSync.mockReturnValue(["ch-backup.log"]);
    mockRegularLog("ch-backup",
      "[2026-05-09 01:34:37] [WATCHDOG] OK: All services healthy\n",
      new Date("2026-05-09T01:34:37.000Z"),
    );

    const { GET } = await import("@/app/api/logs/route");
    const res = await GET(
      new Request("http://localhost/api/logs?name=ch-backup&lines=50") as unknown as NextRequest,
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
