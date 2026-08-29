/** @jest-environment node */
import { NextRequest } from "next/server";

// We test the route handler directly by importing it
// and verifying its behavior through the exported PUT function.

describe("personality route security", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ── Read-only mode ───────────────────────────────────────────

  // Read-only refusal is no longer asserted here, because it is no longer
  // enforced here. T-0048 deleted the per-route guard: `src/proxy.ts` refuses
  // every unsafe method under PS_READ_ONLY before a handler runs, so a test that
  // calls this handler directly bypasses the thing it means to check. The
  // guarantee is asserted per route, in both directions, in
  // tests/unit/read-only-actually-reads.test.ts.

  // ── Path traversal prevention ─────────────────────────────────

  it("rejects profile names with path traversal (../)", async () => {
    delete process.env.CH_READ_ONLY;
    const { PUT } = await import("@/app/api/agent/personality/route");

    const request = new NextRequest("http://localhost/api/agent/personality", {
      method: "PUT",
      body: JSON.stringify({ profile: "../etc", personality: "friendly" }),
    });

    const response = await PUT(request);
    // resolveSafeProfileName rejects ".." in the name
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/invalid/i);
  });

  it("rejects profile names with slashes", async () => {
    delete process.env.CH_READ_ONLY;
    const { PUT } = await import("@/app/api/agent/personality/route");

    const request = new NextRequest("http://localhost/api/agent/personality", {
      method: "PUT",
      body: JSON.stringify({ profile: "foo/bar", personality: "friendly" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it("rejects empty personality", async () => {
    delete process.env.CH_READ_ONLY;
    const { PUT } = await import("@/app/api/agent/personality/route");

    const request = new NextRequest("http://localhost/api/agent/personality", {
      method: "PUT",
      body: JSON.stringify({ personality: "" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/personality is required/i);
  });
});
