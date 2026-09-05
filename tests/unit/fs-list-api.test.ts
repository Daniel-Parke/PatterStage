/** @jest-environment node */

import { NextRequest } from "next/server";

const mockResolveAllowed = jest.fn();

jest.mock("@/lib/fs/path-security", () => ({
  resolveAllowedWorkspacePath: (input: string) => mockResolveAllowed(input),
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(
    (route: string, context: string, error: unknown, message: string) => {
      // Replicate the canonical serverErrorFromCatch behaviour so the
      // byte-equivalence contract is preserved when reading the test
      // results: route + context + error.message logged, then a 500
      // response with the fallback message.
      const { logApiError: _log } = jest.requireMock("@/lib/api-logger") as {
        logApiError: (r: string, c: string, e: unknown) => void;
      };
      _log(route, context, error);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    },
  ),
}));

const mockExistsSync = jest.fn();
const mockStatSync = jest.fn();
const mockReaddirSync = jest.fn();

jest.mock("fs", () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args) as boolean,
  statSync: (...args: unknown[]) => mockStatSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args) as string[],
}));

jest.mock("os", () => ({
  homedir: () => "/home/tester",
}));

describe("GET /api/fs/list", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns entries for an allowed directory", async () => {
    mockResolveAllowed.mockReturnValue({ ok: true, absolute: "/home/tester/proj" });
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockImplementation((p: string) => ({
      isDirectory: () => String(p).endsWith("proj") || String(p).endsWith("sub"),
      isFile: () => String(p).endsWith("readme"),
    }));
    mockReaddirSync.mockReturnValue(["readme", "sub"]);

    const { GET } = await import("@/app/api/fs/list/route");
    const res = await GET(
      new NextRequest("http://localhost/api/fs/list?path=/home/tester/proj"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.path).toBe("/home/tester/proj");
    expect(body.data.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "sub", isDir: true }),
        expect.objectContaining({ name: "readme", isFile: true }),
      ]),
    );
  });

  it("rejects paths outside the allowed workspace policy", async () => {
    mockResolveAllowed.mockReturnValue({
      ok: false,
      error: "Path must be under your home directory, PatterStage data, or a registered agent root",
    });

    const { GET } = await import("@/app/api/fs/list/route");
    const res = await GET(
      new NextRequest("http://localhost/api/fs/list?path=/etc/passwd"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Path must be under/);
  });

  // Pins the "Not a directory" 400 site migrated to badRequest() in
  // session-134. Pre-session-134, the route returned the inline
  // `return NextResponse.json({ error: "Not a directory" }, { status: 400 })`
  // form; the factory call is byte-equivalent (status 400 + same body
  // shape), so this test only needs to assert the observable contract.
  it("returns 400 when the resolved path is not a directory", async () => {
    mockResolveAllowed.mockReturnValue({ ok: true, absolute: "/home/tester/file.txt" });
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({
      isDirectory: () => false,
      isFile: () => true,
    });

    const { GET } = await import("@/app/api/fs/list/route");
    const res = await GET(
      new NextRequest("http://localhost/api/fs/list?path=/home/tester/file.txt"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Not a directory");
  });

  // Pins the catch-block 500 site migrated to serverErrorFromCatch()
  // in session-134. Pre-session-134, the route returned
  // `return NextResponse.json({ error: "Failed to list directory" }, { status: 500 })`
  // via logApiError. The factory preserves the log + response pair
  // (route/context/error.message → log line; fallback message → 500
  // body), so the contract is the same status + same body string.
  it("returns 500 via serverErrorFromCatch when the filesystem call throws", async () => {
    mockResolveAllowed.mockReturnValue({ ok: true, absolute: "/home/tester/proj" });
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({
      isDirectory: () => true,
      isFile: () => false,
    });
    // Force a synchronous throw from the readdirSync call to exercise
    // the outer catch. The previous test coverage was limited to the
    // 200 + 400 paths; this test pins the 500 path.
    mockReaddirSync.mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    const { GET } = await import("@/app/api/fs/list/route");
    const res = await GET(
      new NextRequest("http://localhost/api/fs/list?path=/home/tester/proj"),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to list directory");
  });
});
