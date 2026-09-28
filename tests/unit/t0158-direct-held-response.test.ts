/** @jest-environment node */
/** ADR-0012: an unwrapped gateway GET must recheck revocation before release. */
import { NextRequest } from "next/server";
import {
  createHeldSession, createHeldUpstream, finishHeldResponse, origin,
  revokeAndAssertStoredSession, type HeldResponse, type HeldSession,
} from "../helpers/t0158-held-session";

const mockFetchGateway = jest.fn();
jest.mock("@/lib/models/gateway-client", () => ({
  ...jest.requireActual("@/lib/models/gateway-client"),
  fetchGateway: (...args: unknown[]) => mockFetchGateway(...args),
}));
jest.mock("better-sqlite3", () => jest.requireActual("../../node_modules/better-sqlite3/lib/index.js"));
jest.unmock("@/lib/db");

const path = "/api/gateway/models";
let session: HeldSession;
let operatorToken: string;
const signIn = () => session.signIn();

function heldModels(headers: Record<string, string>, marker: string): HeldResponse {
  const gate = createHeldUpstream(() => new Response(JSON.stringify({ data: [{ id: marker }] }), {
    status: 200, headers: { "content-type": "application/json" },
  }));
  mockFetchGateway.mockImplementation(() => {
    gate.markCalled();
    return gate.upstream;
  });
  // The current export takes no arguments. Pass the request at runtime so a
  // future release-time guard has the real cookie or Bearer context to check.
  type RequestAwareGet = (request: NextRequest) => Promise<Response>;
  const pending = import("@/app/api/gateway/models/route").then(({ GET }) =>
    (GET as RequestAwareGet)(new NextRequest(`${origin}${path}`, { headers })));
  return { pending, called: gate.called, release: gate.release };
}

beforeEach(async () => {
  jest.resetModules();
  mockFetchGateway.mockReset();
  session = await createHeldSession("t0158-direct-gateway-", "http://127.0.0.1:8652");
  operatorToken = session.operatorToken;
});

afterEach(() => {
  session.dispose();
});

describe("T-0158 direct held gateway models GET", () => {
  it("Given a valid browser cookie, a held model response reaches the caller", async () => {
    const cookie = await signIn();
    const marker = "t0158-valid-gateway-model-marker";
    const held = heldModels({ cookie }, marker);
    const response = await finishHeldResponse(held);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(marker);
  });

  it("Given a held model response, revoking its browser cookie prevents release", async () => {
    const cookie = await signIn();
    const marker = "t0158-revoked-gateway-model-marker";
    const held = heldModels({ cookie }, marker);
    const response = await finishHeldResponse(held, () => revokeAndAssertStoredSession(cookie));
    const body = await response.text();
    expect({ status: response.status, exposed: body.includes(marker) }).toEqual({ status: 401, exposed: false });
  });

  it("Given a Bearer client, a held model response reaches the caller", async () => {
    const marker = "t0158-bearer-gateway-model-marker";
    const held = heldModels({ authorization: `Bearer ${operatorToken}` }, marker);
    const response = await finishHeldResponse(held);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(marker);
  });
});
