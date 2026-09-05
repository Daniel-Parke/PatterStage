/** @jest-environment node */
/**
 * B1 (T-0095), D44 and D45: the fast-mode chat proxy.
 *
 * D44. POST /api/orchestration/chat is the third raw fetch to the Hermes
 * gateway, and the only one that sent no Authorization header. HermesRuntime's
 * two callers build theirs from `getGatewayKey()`; this one built
 * `{ "Content-Type": "application/json" }` and nothing else, so a gateway with
 * API_SERVER_KEY set (which setup writes) answered 401 to every fast turn.
 *
 * D45. The same handler recorded `chat.message_sent`, and so does the messages
 * route the page calls first, so a fast turn counted twice in every chat
 * achievement and on Insights.
 */
const mockFetch = jest.fn();
const mockRecordEvent = jest.fn();
const originalFetch = globalThis.fetch;
const ORIGINAL_ENV = process.env;

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.requireActual("@/lib/api-logger").serverErrorFromCatch,
}));
jest.mock("@/lib/analytics/record-event", () => ({
  recordEvent: (...a: unknown[]) => mockRecordEvent(...a),
}));

import { NextRequest } from "next/server";

import { POST } from "@/app/api/orchestration/chat/route";

function post(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/orchestration/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ONE_TURN = { messages: [{ role: "user", content: "hello" }], stream: false };

beforeEach(() => {
  mockFetch.mockReset();
  mockRecordEvent.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ choices: [] }),
  } as unknown as Response);
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  process.env = { ...ORIGINAL_ENV, HERMES_GATEWAY_URL: "http://127.0.0.1:8652" };
  delete process.env.API_SERVER_KEY;
});
afterAll(() => {
  globalThis.fetch = originalFetch;
  process.env = ORIGINAL_ENV;
});

describe("the fast-mode proxy authenticates like every other gateway caller", () => {
  it("sends Authorization: Bearer <API_SERVER_KEY> when a key is configured", async () => {
    process.env.API_SERVER_KEY = "gw-secret-key";
    await POST(post(ONE_TURN));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const init = mockFetch.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers.Authorization).toBe("Bearer gw-secret-key");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("sends no Authorization header at all when no key is configured", async () => {
    await POST(post(ONE_TURN));
    const init = mockFetch.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("does the same on the streaming path, which is the default", async () => {
    process.env.API_SERVER_KEY = "gw-secret-key";
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, body: "stream" } as unknown as Response);
    await POST(post({ messages: [{ role: "user", content: "hi" }] }));
    const init = mockFetch.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers.Authorization).toBe("Bearer gw-secret-key");
  });
});

describe("a fast turn is counted once", () => {
  it("does not record chat.message_sent here: the messages route already did", async () => {
    await POST(post(ONE_TURN));
    expect(mockRecordEvent).not.toHaveBeenCalled();
  });
});
