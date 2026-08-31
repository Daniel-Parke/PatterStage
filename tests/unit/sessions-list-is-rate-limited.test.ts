/** @jest-environment node */

// T-0083 — the other half of QA finding 13, and a gap I created myself.
//
// The reporter fired 130 requests at /api/sessions and never saw a 429. A real
// sliding-window limiter has existed since the sessions API was written; it was
// simply never attached to the LIST route — only to /api/sessions/[id]. I wired
// it and shipped no test, and a mutation sweep duly showed that removing the
// wiring again changed nothing observable.
//
// The list is also the more expensive of the two reads: it syncs from Hermes
// and scans the table, where the [id] route reads a single row. If either
// deserved the limiter first, it was this one.

const mockListSessions = jest.fn();
const mockGetSession = jest.fn();

jest.mock("@/lib/sessions/session-repository", () => ({
  listSessions: (...a: unknown[]) => mockListSessions(...a),
  getSession: (id: string) => mockGetSession(id),
  createSession: jest.fn(),
  updateSession: jest.fn(),
}));

jest.mock("@/lib/sync", () => ({ ensureSyncLayer: jest.fn(), syncSessionsNow: jest.fn() }));
jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.requireActual("@/lib/api-logger").serverErrorFromCatch,
}));

import { NextRequest } from "next/server";

import { GET } from "@/app/api/sessions/route";

function listRequest(from: string) {
  return new NextRequest("http://localhost:4242/api/sessions", {
    headers: { "x-forwarded-for": from },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListSessions.mockReturnValue({ sessions: [], total: 0, totals: {} });
});

describe("GET /api/sessions is rate limited", () => {
  it("answers 429 to a client that will not stop", async () => {
    // The reported case, in one test: 130 requests, no 429.
    let sawThrottle = false;
    for (let i = 0; i < 200 && !sawThrottle; i++) {
      const res = await GET(listRequest("10.1.0.1"));
      if (res.status === 429) sawThrottle = true;
    }

    expect(sawThrottle).toBe(true);
  });

  it("stops doing the expensive work once it is throttling", async () => {
    // The point of a limiter is not the status code. If the route kept
    // scanning the table and syncing from Hermes and then answered 429, the
    // cost the limiter exists to avoid would still be paid on every request.
    for (let i = 0; i < 200; i++) {
      const res = await GET(listRequest("10.1.0.2"));
      if (res.status === 429) break;
    }
    const callsBefore = mockListSessions.mock.calls.length;

    await GET(listRequest("10.1.0.2"));

    expect(mockListSessions.mock.calls.length).toBe(callsBefore);
  });

  it("does not throttle a different client", async () => {
    for (let i = 0; i < 200; i++) {
      const res = await GET(listRequest("10.1.0.3"));
      if (res.status === 429) break;
    }

    expect((await GET(listRequest("10.1.0.4"))).status).toBe(200);
  });

  it("GREEN CONTROL: an ordinary request is answered normally", async () => {
    mockListSessions.mockReturnValue({
      sessions: [{ id: "s1" }],
      total: 1,
      totals: {},
    });

    const res = await GET(listRequest("10.1.0.5"));
    const body = (await res.json()) as { data?: { sessions?: unknown[] } };

    expect(res.status).toBe(200);
    expect(body.data?.sessions).toHaveLength(1);
  });
});
