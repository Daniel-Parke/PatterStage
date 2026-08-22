/** @jest-environment node */

// Tests for /api/personalities route — focus on the POST/PUT body parsing
// regression. Before parseJsonBody was extracted, request.json() in the
// shared upsertPersonality helper had no try/catch, so invalid JSON threw
// an unhandled exception that the outer POST/PUT try/catch caught and
// returned as 500 "Failed to save personality". Now it correctly returns
// 400 "Invalid JSON".

import { NextRequest } from "next/server";

jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));
jest.mock("@/lib/api-auth", () => ({ requireAuth: jest.fn(() => null) }));

jest.mock("@/lib/db", () => ({ ensureDb: jest.fn() }));

jest.mock("@/lib/agent-root-repository", () => ({
  getAgentRoot: jest.fn(() => ({ soulMd: "", disabledSkillsJson: "[]" })),
  updateAgentRoot: jest.fn(),
}));

jest.mock("@/modules/hermes/lib/profiles-repository", () => ({
  listProfiles: jest.fn(() => []),
  updateProfileContent: jest.fn(() => true),
}));

jest.mock("@/modules/hermes/lib/profile-sync", () => ({
  pushProfileToHermes: jest.fn(() => ({ success: true })),
  pushRootToHermes: jest.fn(() => ({ success: true })),
}));

jest.mock("@/lib/fs/path-security", () => ({
  resolveSafeProfileName: jest.fn((param: string | null) => {
    const profile = (param || "default").trim();
    if (profile === "default") return { ok: true, profile: "default" };
    if (/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(profile)) return { ok: true, profile };
    return { ok: false, error: "Invalid profile name" };
  }),
  // The route uses requireSafeProfileName — return { profile } for any sane name.
  requireSafeProfileName: jest.fn((name: string) => ({ profile: name.trim() })),
}));

jest.mock("@/modules/hermes/handlers/profile-patch", () => ({
  applyProfileOrRootPatchOrFail: jest.fn((profile: string) => ({ profile })),
}));

describe("POST /api/personalities — invalid JSON body handling", () => {
  it("returns 400 on invalid JSON (regression — was 500)", async () => {
    const { POST } = await import("@/app/api/personalities/route");
    const req = new NextRequest("http://localhost/api/personalities", {
      method: "POST",
      body: "{not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });
});

describe("PUT /api/personalities — invalid JSON body handling", () => {
  it("returns 400 on invalid JSON (regression — was 500)", async () => {
    const { PUT } = await import("@/app/api/personalities/route");
    const req = new NextRequest("http://localhost/api/personalities", {
      method: "PUT",
      body: "{not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });
});

describe("POST /api/personalities — profile safety (no silent default overwrite)", () => {
  async function post(body: unknown) {
    const { POST } = await import("@/app/api/personalities/route");
    const req = new NextRequest("http://localhost/api/personalities", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
    return POST(req);
  }

  it("returns 400 when profile is missing (must not default to 'default')", async () => {
    const res = await post({ prompt: "You are a pirate" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/profile is required/i);
  });

  it("returns 400 when profile is blank", async () => {
    const res = await post({ profile: "   ", prompt: "You are a pirate" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown profile (never writes default SOUL.md)", async () => {
    // listProfiles() is mocked to [] above, so any non-default profile is unknown.
    const res = await post({ profile: "ghost", prompt: "You are a ghost" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/unknown profile/i);
  });

  it("accepts an explicit existing profile (default)", async () => {
    const res = await post({ profile: "default", prompt: "You are Bob" });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/personalities", () => {
  it("returns 405 with descriptive error (no individual delete)", async () => {
    const { DELETE } = await import("@/app/api/personalities/route");
    const res = await DELETE();
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.error).toMatch(/cannot be deleted/i);
  });
});
