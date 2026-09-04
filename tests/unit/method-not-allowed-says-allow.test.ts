/** @jest-environment node */

// T-0089: round 6, finding 15, wider than reported. Next's framework 405 is
// empty-bodied with no Allow header. Our own methodNotAllowed helper set a
// body and ALSO never set Allow, so every T-0083 stub was
// helpful-body-without-Allow. RFC 9110 says a 405 MUST carry Allow; a client
// that reads it can correct itself without a docs lookup.

import { NextRequest } from "next/server";
import { methodNotAllowed } from "@/lib/api-response";

describe("methodNotAllowed", () => {
  it("sets the Allow header from the verbs the route serves", async () => {
    const res = methodNotAllowed("GET is not supported here", ["POST", "DELETE"]);

    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST, DELETE");
    expect(((await res.json()) as { error: string }).error).toMatch(/not supported/);
  });

  it("keeps the body when no verbs are given, and sets no misleading Allow", () => {
    const res = methodNotAllowed("Nothing here");

    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBeNull();
  });
});

describe("the skills toggle answers a stub, not a framework 405", () => {
  jest.mock("@/lib/api-auth", () => ({ requireNotReadOnly: () => null }));
  jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn(), serverErrorFromCatch: jest.fn() }));
  jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
  jest.mock("@/lib/db", () => ({ ensureDb: jest.fn(), getDb: jest.fn(), now: () => "t", uuid: () => "u", inTransaction: <T,>(fn: () => T) => fn() }));
  jest.mock("@/lib/skills-repository", () => ({ getSkill: jest.fn(), upsertSkill: jest.fn(), parseSkillFrontmatter: jest.fn() }));
  jest.mock("@/modules/hermes/lib/profile-push", () => ({ pushSkillToHermes: jest.fn() }));

  it("POST /api/skills/[name] says what to do instead, with Allow", async () => {
    const route = (await import("@/app/api/skills/[name]/route")) as { POST?: (r: NextRequest, c: { params: Promise<{ name: string }> }) => Promise<Response> };
    expect(typeof route.POST).toBe("function");

    const res = await route.POST!(
      new NextRequest("http://localhost/api/skills/devops-terminal", { method: "POST" }),
      { params: Promise.resolve({ name: "devops-terminal" }) },
    );
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET, PUT");
    expect(body.error).toMatch(/PUT/);
    expect(body.error).toMatch(/disabled|toggle|skills\.disabled/i);
  });
});
