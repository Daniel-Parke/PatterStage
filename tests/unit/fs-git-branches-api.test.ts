/** @jest-environment node */

import { NextRequest } from "next/server";

const mockResolveAllowed = jest.fn();
const mockReadGit = jest.fn();

jest.mock("@/lib/fs/path-security", () => ({
  resolveAllowedWorkspacePath: (input: string) => mockResolveAllowed(input),
}));

jest.mock("@/lib/git/git-workspace-branches", () => ({
  readGitBranchMetadataForWorkspacePath: (abs: string) => mockReadGit(abs),
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  // serverErrorFromCatch is the canonical 2-line catch-block shim that
  // composes logApiError + serverError. The real helper from
  // @/lib/api-logger is used here so the test exercises the same
  // wire-format contract as production (status 500, body
  // { error: <message> }).
  serverErrorFromCatch: jest.requireActual("@/lib/api-logger").serverErrorFromCatch,
}));

describe("GET /api/fs/git/branches (route)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveAllowed.mockReturnValue({ ok: true, absolute: "/home/tester/repo" });
  });

  it("requires path query param", async () => {
    const { GET } = await import("@/app/api/fs/git/branches/route");
    const res = await GET(new NextRequest("http://localhost/api/fs/git/branches"));
    expect(res.status).toBe(400);
    expect(mockReadGit).not.toHaveBeenCalled();
  });

  it("returns 400 when path is not allowed", async () => {
    mockResolveAllowed.mockReturnValue({ ok: false, error: "Path must be under home" });
    const { GET } = await import("@/app/api/fs/git/branches/route");
    const res = await GET(
      new NextRequest("http://localhost/api/fs/git/branches?path=/etc"),
    );
    expect(res.status).toBe(400);
    expect(mockReadGit).not.toHaveBeenCalled();
  });

  it("delegates to readGitBranchMetadataForWorkspacePath and returns data", async () => {
    mockReadGit.mockResolvedValue({
      isGitRepo: true,
      branches: ["main"],
      current: "main",
    });
    const { GET } = await import("@/app/api/fs/git/branches/route");
    const res = await GET(
      new NextRequest("http://localhost/api/fs/git/branches?path=/home/tester/repo"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({
      isGitRepo: true,
      branches: ["main"],
      current: "main",
    });
    expect(mockReadGit).toHaveBeenCalledWith("/home/tester/repo");
  });

  // session 124 byte-equivalence test — the catch block uses
  // serverErrorFromCatch(route, context, error, message) to produce
  // the same 500 + { error: "Failed to read git branches" } response
  // as the pre-refactor inline NextResponse.json + logApiError pair.
  // Throwing from the readGitBranchMetadataForWorkspacePath mock
  // exercises the catch block end-to-end.
  it("returns 500 with the static 'Failed to read git branches' message when readGitBranchMetadataForWorkspacePath throws (serverErrorFromCatch byte-equivalence)", async () => {
    mockReadGit.mockRejectedValue(new Error("git binary not found"));
    const { GET } = await import("@/app/api/fs/git/branches/route");
    const res = await GET(
      new NextRequest("http://localhost/api/fs/git/branches?path=/home/tester/repo"),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Failed to read git branches" });
  });
});
