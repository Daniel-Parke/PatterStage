/** @jest-environment node */
/** ADR-0012: a queued Hindsight GET must not release data after revocation. */
import { NextRequest, NextResponse } from "next/server";
import {
  createHeldSession, createHeldUpstream, finishHeldResponse, origin,
  revokeAndAssertStoredSession, type HeldResponse, type HeldSession,
} from "../helpers/t0158-held-session";

jest.mock("better-sqlite3", () => jest.requireActual("../../node_modules/better-sqlite3/lib/index.js"));
jest.unmock("@/lib/db");

const path = "/api/memory/hindsight?action=list";
const originalFetch = globalThis.fetch;
let session: HeldSession;
let operatorToken: string;
const signIn = () => session.signIn();

function heldGet(headers: Record<string, string>, marker: string): HeldResponse {
  const gate = createHeldUpstream(() => new Response(JSON.stringify({
    items: [{ id: "held-memory", text: marker, fact_type: "preference", date: "2026-09-28", tags: [] }],
    total: 1,
  }), { status: 200, headers: { "content-type": "application/json" } }));
  globalThis.fetch = jest.fn(async () => {
    gate.markCalled();
    return gate.upstream;
  }) as typeof fetch;
  const pending = import("@/app/api/memory/hindsight/route").then(({ GET }) =>
    GET(new NextRequest(`${origin}${path}`, { headers })));
  return { pending, called: gate.called, release: gate.release };
}

beforeEach(async () => {
  jest.resetModules();
  session = await createHeldSession("t0158-held-hindsight-");
  operatorToken = session.operatorToken;
});

afterEach(() => {
  session.dispose();
  globalThis.fetch = originalFetch;
});

describe("T-0158 held Hindsight GET", () => {
  it("Given a live browser session, a held protected response reaches the caller", async () => {
    const cookie = await signIn();
    const marker = "t0158-live-hindsight-marker";
    const held = heldGet({ cookie }, marker);
    const response = await finishHeldResponse(held);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(marker);
  });

  it("Given a held protected response, revoking its browser session prevents release", async () => {
    const cookie = await signIn();
    const marker = "t0158-revoked-hindsight-marker";
    const held = heldGet({ cookie }, marker);
    const response = await finishHeldResponse(held, () => revokeAndAssertStoredSession(cookie));
    const body = await response.text();
    expect({ status: response.status, exposed: body.includes(marker) }).toEqual({ status: 401, exposed: false });
  });

  it("Given a Bearer client, a held protected response reaches the caller", async () => {
    const marker = "t0158-bearer-hindsight-marker";
    const held = heldGet({ authorization: `Bearer ${operatorToken}` }, marker);
    const response = await finishHeldResponse(held);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(marker);
  });
});

it("Given a held shared route handler, revoking its browser session prevents release", async () => {
  const cookie = await signIn();
  const marker = "t0158-revoked-wrapped-route-marker";
  let markCalled!: () => void;
  let release!: () => void;
  const called = new Promise<void>((resolve) => { markCalled = resolve; });
  const held = new Promise<void>((resolve) => { release = resolve; });
  const { route } = await import("@/lib/api/api-route");
  const GET = route("GET /api/held-response-oracle", "reading a protected result", "Failed to read protected result", async (_request: NextRequest) => {
    markCalled();
    await held;
    return NextResponse.json({ marker });
  });
  const pending = GET(new NextRequest(`${origin}/api/held-response-oracle`, { headers: { cookie } }));
  const response = await finishHeldResponse({ called, release, pending }, () => revokeAndAssertStoredSession(cookie));
  const body = await response.text();
  expect({ status: response.status, exposed: body.includes(marker) }).toEqual({ status: 401, exposed: false });
});
