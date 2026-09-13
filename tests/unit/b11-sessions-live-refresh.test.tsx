/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B11 oracle, live means live (T-0105, contract §5, D36).
//
// Written before the product code moved.
//
// The defect: useSessions passes no refetchInterval, yet the page runs a 1s
// interval purely to re-render the elapsed-time text. So a session that
// finished ten minutes ago keeps a pulsing dot beside a counter that ticks
// up, and the timer is what makes the stale data look live. Either both run
// or neither does: the list polls while something is active, and the clock
// ticks only while something on the page is actually running.
//
// The hook is mocked, because the claim is about the WIRING — what the page
// asks the data layer for — and that is precisely the code no rendered
// assertion against a stubbed fetch can pin without racing a timer.
// ═══════════════════════════════════════════════════════════════

import { screen, waitFor } from "@testing-library/react";

import { renderWithQuery } from "../helpers/render-with-query";
import type { SessionRecord } from "@/lib/sessions/session-repository";

/** The cadence the contract names. Also exported by the hook module. */
const POLL_MS = 10_000;

const mockUseSessions = jest.fn();

jest.mock("@/hooks/useSessions", () => ({
  SESSIONS_LIVE_POLL_MS: 10_000,
  useSessions: (...args: unknown[]) => mockUseSessions(...args),
}));

import SessionsPage from "@/app/results/sessions/page";

function row(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "sess-1",
    agentType: "hermes",
    source: "cli",
    missionId: null,
    profileName: null,
    modelId: null,
    provider: null,
    title: "Triage the queue",
    size: 2048,
    startedAt: new Date(Date.now() - 120_000).toISOString(),
    endedAt: null,
    status: "completed",
    exitCode: 0,
    error: null,
    messageCount: 3,
    ...over,
  } as SessionRecord;
}

function payload(sessions: SessionRecord[], active: number) {
  return {
    data: {
      sessions,
      total: sessions.length,
      totals: {
        total: sessions.length,
        active,
        messages: 0,
        bySource: { cli: sessions.length },
      },
      sources: ["cli"],
    },
    isLoading: false,
    isFetching: false,
    error: null,
    errorBody: null,
    meta: null,
    refetch: jest.fn(),
  };
}

/**
 * What the page asked the hook for. The post-B11 signature is one object;
 * before it, the first argument is the page number, which is exactly the
 * difference this oracle is measuring.
 */
function askedFor(): Record<string, unknown> {
  const call = mockUseSessions.mock.calls[mockUseSessions.mock.calls.length - 1] ?? [];
  const first = call[0];
  return first && typeof first === "object" ? (first as Record<string, unknown>) : {};
}

const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  // AgentSetupNotice reads /api/monitor through its own query; answer it so
  // nothing in this file depends on a network that is not there.
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: { framework: { type: "hermes", name: "Hermes", available: true } } }),
    text: async () => "{}",
  })) as unknown as typeof global.fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  window.localStorage.clear();
});

describe("the list polls while something is live", () => {
  it("asks for a poll when a session on the page is running", async () => {
    mockUseSessions.mockReturnValue(payload([row({ status: "active" })], 1));

    renderWithQuery(<SessionsPage />);
    await screen.findByText("Triage the queue");

    expect(askedFor().refetchIntervalMs).toBe(POLL_MS);
  });

  it("asks for a poll when the table holds a running session the page cannot see", async () => {
    // The whole-table `active` count is the honest signal: the live session
    // may be on page 4 of the filter the user is looking at.
    mockUseSessions.mockReturnValue(payload([row({ status: "completed" })], 3));

    renderWithQuery(<SessionsPage />);
    await screen.findByText("Triage the queue");

    expect(askedFor().refetchIntervalMs).toBe(POLL_MS);
  });

  it("asks for no poll at all when nothing is running", async () => {
    mockUseSessions.mockReturnValue(payload([row({ status: "completed" })], 0));

    renderWithQuery(<SessionsPage />);
    await screen.findByText("Triage the queue");

    expect(askedFor().refetchIntervalMs).toBe(false);
  });

  it("hands the hook the filters as one object, so a new filter cannot be dropped on the way", async () => {
    mockUseSessions.mockReturnValue(payload([row()], 0));

    renderWithQuery(<SessionsPage />);
    await screen.findByText("Triage the queue");

    expect(askedFor()).toEqual(
      expect.objectContaining({
        page: expect.any(Number),
        pageSize: expect.any(Number),
      }),
    );
  });
});

describe("the one-second clock runs only for a session that is running", () => {
  it("stops ticking when every session on the page has finished", async () => {
    jest.useFakeTimers();
    try {
      mockUseSessions.mockReturnValue(payload([row({ status: "completed" })], 0));
      const setInterval = jest.spyOn(globalThis, "setInterval");

      renderWithQuery(<SessionsPage />);

      // The elapsed-time tick is the only 1000ms interval this page owns.
      const oneSecondTimers = setInterval.mock.calls.filter(([, ms]) => ms === 1000);
      expect(oneSecondTimers).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it("GUARD: it still ticks while a session on the page is running", async () => {
    jest.useFakeTimers();
    try {
      mockUseSessions.mockReturnValue(payload([row({ status: "active" })], 1));
      const setInterval = jest.spyOn(globalThis, "setInterval");

      renderWithQuery(<SessionsPage />);

      await waitFor(() =>
        expect(setInterval.mock.calls.filter(([, ms]) => ms === 1000).length).toBeGreaterThan(0),
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
