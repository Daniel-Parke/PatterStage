/** @jest-environment node */
/** ADR-0012: the direct GET in a mixed-method route must stop after revocation. */
import { NextRequest, NextResponse } from "next/server";
import {
  createHeldSession,
  createHeldUpstream,
  finishHeldResponse,
  origin,
  revokeAndAssertStoredSession,
  type HeldResponse,
  type HeldSession,
} from "../helpers/t0158-held-session";

const mockHandleListTemplates = jest.fn();
jest.mock("@/lib/templates-handlers/list", () => ({
  handleListTemplates: () => mockHandleListTemplates(),
}));
jest.mock("better-sqlite3", () => jest.requireActual("../../node_modules/better-sqlite3/lib/index.js"));
jest.unmock("@/lib/db");

let session: HeldSession | undefined;

function heldTemplates(headers: Record<string, string>, marker: string): HeldResponse {
  const upstream = createHeldUpstream(() => NextResponse.json({
    data: { templates: [{ id: marker, name: "Held template" }] },
  }));
  mockHandleListTemplates.mockImplementation(() => {
    upstream.markCalled();
    return upstream.upstream;
  });
  // The current direct GET accepts no typed argument. Supply the real request
  // at runtime so a release-time guard can inspect its auth context.
  type RequestAwareGet = (request: NextRequest) => Promise<Response>;
  const pending = import("@/app/api/templates/route").then(({ GET }) =>
    (GET as RequestAwareGet)(new NextRequest(`${origin}/api/templates`, { headers })));
  return { pending, called: upstream.called, release: upstream.release };
}

beforeEach(async () => {
  jest.resetModules();
  mockHandleListTemplates.mockReset();
  session = await createHeldSession("t0158-mixed-templates-");
});

afterEach(() => {
  session?.dispose();
  session = undefined;
});

describe("T-0158 mixed-method templates GET", () => {
  it("Given a valid browser cookie, a held templates response reaches the caller", async () => {
    const cookie = await session!.signIn();
    const marker = "t0158-valid-template-marker";
    const response = await finishHeldResponse(heldTemplates({ cookie }, marker));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(marker);
  });

  it("Given a held templates response, revoking its browser cookie prevents release", async () => {
    const cookie = await session!.signIn();
    const marker = "t0158-revoked-template-marker";
    const response = await finishHeldResponse(
      heldTemplates({ cookie }, marker),
      () => revokeAndAssertStoredSession(cookie),
    );
    const body = await response.text();
    expect({ status: response.status, exposed: body.includes(marker) }).toEqual({ status: 401, exposed: false });
  });

  it("Given a Bearer client, a held templates response reaches the caller", async () => {
    const marker = "t0158-bearer-template-marker";
    const response = await finishHeldResponse(heldTemplates({
      authorization: `Bearer ${session!.operatorToken}`,
    }, marker));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(marker);
  });
});
