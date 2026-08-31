/** @jest-environment node */

// T-0080 — the fast-mode chat path answered 500 with nothing in it.
//
// Found while proving the batch live rather than by reading it. With the
// gateway stopped, `POST /api/orchestration/chat` returns:
//
//     status=500 size=0
//
// Not a bad message. NO message. `apiFetch` turns that into "API returned
// invalid JSON (HTTP 500)", so the operator whose gateway is off is told their
// own server sent garbage.
//
// THE CAUSE is one missing keyword. The handler ends its try block with
//
//     return fetchGateway(apiUrl, gatewayBody, isStreaming);
//
// A bare `return` of a promise inside `try` does not put the rejection inside
// the try: the value is settled after the block has already exited, so the
// catch below it — which exists, and calls serverErrorFromCatch — never runs.
// The rejection escapes the handler entirely and Next answers a bodiless 500.
//
// This is a THIRD raw fetch to the gateway, alongside HermesRuntime's two, and
// the only one on the fast-mode chat path. It gets the same treatment: name
// the gateway, say what to do.

import { NextRequest } from "next/server";

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;
const ORIGINAL_ENV = process.env;

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.requireActual("@/lib/api-logger").serverErrorFromCatch,
}));

jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

import { POST } from "@/app/api/orchestration/chat/route";

function post(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/orchestration/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function connectionRefused(): TypeError {
  return Object.assign(new TypeError("fetch failed"), {
    cause: Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:8652"), {
      code: "ECONNREFUSED",
    }),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  process.env = { ...ORIGINAL_ENV, HERMES_GATEWAY_URL: "http://127.0.0.1:8652" };
});
afterAll(() => {
  globalThis.fetch = originalFetch;
  process.env = ORIGINAL_ENV;
});

const ONE_TURN = { messages: [{ role: "user", content: "hello" }], stream: false };

describe("a chat turn against a stopped gateway explains itself", () => {
  it("answers with a BODY at all", async () => {
    // The assertion that would have caught this on day one, and the cheapest
    // one in the file: a 500 whose body is zero bytes is not an error message,
    // it is a hang-up.
    mockFetch.mockRejectedValueOnce(connectionRefused());

    const res = await POST(post(ONE_TURN));
    const text = await res.text();

    expect(text.length).toBeGreaterThan(0);
  });

  it("names the gateway it could not reach", async () => {
    mockFetch.mockRejectedValueOnce(connectionRefused());

    const body = (await (await POST(post(ONE_TURN))).json()) as { error?: string };

    expect(body.error).toContain("http://127.0.0.1:8652");
  });

  it("says what to do about it", async () => {
    mockFetch.mockRejectedValueOnce(connectionRefused());

    const body = (await (await POST(post(ONE_TURN))).json()) as { error?: string };

    expect(body.error).toMatch(/hermes gateway/i);
  });

  it("does not hand back undici's own words", async () => {
    mockFetch.mockRejectedValueOnce(connectionRefused());

    const body = (await (await POST(post(ONE_TURN))).json()) as { error?: string };

    expect(body.error).not.toMatch(/fetch failed/i);
  });

  it("answers 503, so the client can tell a dead gateway from a broken server", async () => {
    // A 500 says PatterStage is at fault. It is not: it is working correctly
    // and reporting that something it depends on is not running.
    mockFetch.mockRejectedValueOnce(connectionRefused());

    expect((await POST(post(ONE_TURN))).status).toBe(503);
  });

  it("does the same for a STREAMING turn, which is the default", async () => {
    // `stream` defaults to true, so the streaming path is the one nearly every
    // real turn takes -- and it returns before any body is read, which is
    // exactly where a returned-but-unawaited promise hides.
    mockFetch.mockRejectedValueOnce(connectionRefused());

    const res = await POST(post({ messages: [{ role: "user", content: "hi" }] }));
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(503);
    expect(body.error).toContain("http://127.0.0.1:8652");
  });
});

describe("GREEN CONTROLS: everything else is unchanged", () => {
  it("a gateway that answers still streams straight through", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: "a-readable-stream",
    } as unknown as Response);

    const res = await POST(post({ messages: [{ role: "user", content: "hi" }] }));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("a non-streaming turn still returns the parsed JSON", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "hi back" } }] }),
    } as unknown as Response);

    const body = (await (await POST(post(ONE_TURN))).json()) as {
      data?: { choices?: { message: { content: string } }[] };
    };

    expect(body.data?.choices?.[0]?.message.content).toBe("hi back");
  });

  it("an HTTP error from a LIVE gateway keeps its own status and text", async () => {
    // The gateway answered. That is a different fact from the gateway being
    // down, and flattening the two would undo the distinction this whole task
    // is about.
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => "model not loaded",
    } as unknown as Response);

    const res = await POST(post(ONE_TURN));
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(422);
    expect(body.error).toContain("model not loaded");
  });

  it("a missing messages array is still a 400, not a gateway story", async () => {
    const res = await POST(post({ model: "default" }));

    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
