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
  jest.mock("@/lib/db", () => ({ ensureDb: jest.fn(), getDb: jest.fn(), now: () => "t", uuid: () => "u", inTransaction: <T,>(fn: () => T) => fn() }));
  jest.mock("@/lib/agent-root-repository", () => ({ getAgentRoot: jest.fn() }));
  jest.mock("@/modules/hermes/lib/profiles-repository", () => ({ getDisabledSkills: jest.fn(), getProfile: jest.fn() }));
  jest.mock("@/modules/hermes/handlers/profile-patch", () => ({ applyProfileOrRootPatchOrFail: jest.fn() }));

  it.each(["GET", "POST"])("%s /api/skills/[name]/toggle says the verb is PUT, with Allow", async (verb) => {
    const route = (await import("@/app/api/skills/[name]/toggle/route")) as Record<string, (r: NextRequest, c: { params: Promise<{ name: string }> }) => Promise<Response>>;
    expect(typeof route[verb]).toBe("function");

    const res = await route[verb](
      new NextRequest("http://localhost/api/skills/devops-terminal/toggle", { method: verb }),
      { params: Promise.resolve({ name: "devops-terminal" }) },
    );
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("PUT");
    expect(body.error).toMatch(/PUT \/api\/skills\/\[name\]\/toggle/);
    expect(body.error).toMatch(/enabled/);
  });
});
