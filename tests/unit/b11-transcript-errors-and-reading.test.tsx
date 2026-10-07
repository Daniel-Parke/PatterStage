/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B11 oracle, the transcript screen (T-0105, contract §2 §5 §7 §9 §11).
//
// Written before the product code moved. What each case pins:
//
//   D33  Every failure renders one branch: <h2>Session Not Found</h2> with
//        the raw message under it and no way back in. The route answers 400,
//        413, 429 and 500 as well as 404, and all five currently claim the
//        session does not exist. The heading follows the status and the
//        banner is the shared LoadErrorBanner, with its Retry.
//   D30  A failed session's exit code and error are on the record and
//        rendered nowhere, here least of all: the transcript is where a
//        person goes to find out what went wrong.
//   D36  The Refresh button is gated on a note that only exists when the
//        transcript is EMPTY, so a running session that has written
//        messages has no refresh at all, and nothing polls.
//   D38  The transcript opens fully collapsed with no expand-all, no
//        in-transcript search and no way to take the conversation away.
//   D40  Nothing tells the reader that what they are looking at is the tail
//        of a longer conversation.
//
// The data hook is mocked: these are claims about what the screen does with
// an answer, not about how the answer is fetched.
// ═══════════════════════════════════════════════════════════════

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const SESSION_ID = "sess-b11";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "sess-b11" }),
  // PageHeader resolves its own title from the route registry.
  usePathname: () => "/results/sessions/sess-b11",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockUseSessionDetail = jest.fn();
jest.mock("@/hooks/useSessionDetail", () => ({
  useSessionDetail: (...args: unknown[]) => mockUseSessionDetail(...args),
}));

import SessionDetailPage from "@/app/results/sessions/[id]/page";

// Trimmed on purpose: testing-library normalises an element's text before
// comparing, so a fixture with a trailing space can never be matched by
// getByText and the case would fail whatever the product did.
const LONG_ANSWER = (
  "The queue drained cleanly. " + "Every job was retried with the same backoff. ".repeat(12)
).trim();

const MESSAGES = [
  { index: 0, role: "user", content: "Please triage the queue and tell me about the needle" },
  { index: 1, role: "assistant", content: LONG_ANSWER },
  { index: 2, role: "tool", content: "queue.drain() -> ok" },
];

function loaded(over: Record<string, unknown> = {}) {
  return {
    data: {
      id: SESSION_ID,
      filename: SESSION_ID,
      format: "db",
      title: "Triage the queue",
      model: "sonnet-4",
      source: "cli",
      messages: MESSAGES,
      messageCount: MESSAGES.length,
      size: 4096,
      created: "2026-09-05T10:00:00.000Z",
      status: "completed",
      exitCode: 0,
      error: null,
      truncated: false,
      ...over,
    },
    isLoading: false,
    error: null,
    errorStatus: null,
    refetch: jest.fn(),
  };
}

function failedToLoad(error: string, errorStatus: number | null) {
  return { data: null, isLoading: false, error, errorStatus, refetch: jest.fn() };
}

/** The options the page hands the data hook, whatever shape it hands them in. */
function hookOptions(): Record<string, unknown> {
  const call = mockUseSessionDetail.mock.calls[mockUseSessionDetail.mock.calls.length - 1] ?? [];
  const second = call[1];
  return second && typeof second === "object" ? (second as Record<string, unknown>) : {};
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSessionDetail.mockReturnValue(loaded());
  Object.assign(navigator, { clipboard: { writeText: jest.fn(async () => {}) } });
});

// ═══════════════════════════════════════════════════════════════
// D33 — the failure that happened, not the one heading
// ═══════════════════════════════════════════════════════════════

describe("a transcript that will not load says which failure it was", () => {
  it.each([
    [413, "Session file is too large to load in PatterStage (max 64 MB).", /too large/i],
    [429, "Too many session requests. Try again in a minute.", /too many/i],
    [400, "Invalid session ID", /not valid/i],
    [404, 'Session "sess-b11" not found', /not found/i],
    [500, "Failed to read session", /Couldn't load/i],
    [null, "No response after 45s (/api/sessions/sess-b11)", /Couldn't load/i],
  ])("a %s reads as %s", (status, message, heading) => {
    mockUseSessionDetail.mockReturnValue(failedToLoad(message, status as number | null));

    render(<SessionDetailPage />);

    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  });

  it("never claims a session is missing when the answer said otherwise", () => {
    mockUseSessionDetail.mockReturnValue(
      failedToLoad("Session file is too large to load in PatterStage (max 64 MB).", 413),
    );

    render(<SessionDetailPage />);

    expect(screen.queryByText(/Session Not Found/i)).toBeNull();
  });

  it("offers the read-error banner with a Retry that re-reads", () => {
    const state = failedToLoad("Too many session requests. Try again in a minute.", 429);
    mockUseSessionDetail.mockReturnValue(state);

    render(<SessionDetailPage />);

    const banner = screen.getByRole("alert");
    expect(within(banner).getByText(/Too many session requests/)).toBeInTheDocument();
    fireEvent.click(within(banner).getByRole("button", { name: /Retry/i }));

    expect(state.refetch).toHaveBeenCalled();
  });

  it("GUARD: the way back to the list is still there", () => {
    mockUseSessionDetail.mockReturnValue(failedToLoad("Failed to read session", 500));

    render(<SessionDetailPage />);

    expect(screen.getByRole("link", { name: /Back to Sessions/i }).getAttribute("href")).toBe(
      "/results/sessions",
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// D30 — the transcript says the session failed
// ═══════════════════════════════════════════════════════════════

describe("a failed session says so on its own transcript", () => {
  it("shows the status, the exit code and the error", () => {
    mockUseSessionDetail.mockReturnValue(
      loaded({ status: "failed", exitCode: 137, error: "Killed by the OOM killer" }),
    );

    render(<SessionDetailPage />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Failed/);
    expect(alert.textContent).toMatch(/137/);
    expect(alert.textContent).toMatch(/Killed by the OOM killer/);
  });

  it("GUARD: a session that finished cleanly raises no alarm", () => {
    render(<SessionDetailPage />);

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// D36 — a running transcript can be refreshed, and refreshes itself
// ═══════════════════════════════════════════════════════════════

describe("a running transcript", () => {
  it("offers Refresh even once the agent has written messages", () => {
    const state = loaded({ status: "active" });
    mockUseSessionDetail.mockReturnValue(state);

    render(<SessionDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));
    expect(state.refetch).toHaveBeenCalled();
  });

  it("asks the data layer to poll while it runs", () => {
    mockUseSessionDetail.mockReturnValue(loaded({ status: "active" }));

    render(<SessionDetailPage />);

    expect(hookOptions().refetchIntervalMs).toBe(10_000);
  });

  it("GUARD: asks for no poll once it has finished, and offers no Refresh", () => {
    render(<SessionDetailPage />);

    expect(hookOptions().refetchIntervalMs ?? false).toBe(false);
    expect(screen.queryByRole("button", { name: /Refresh/i })).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// D38 — reading a long transcript
// ═══════════════════════════════════════════════════════════════

describe("a transcript can be read without two hundred clicks", () => {
  it("opens every message at once, and closes them again", async () => {
    render(<SessionDetailPage />);

    // Collapsed, the long answer is a 120-character summary.
    expect(screen.queryByText(LONG_ANSWER)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Expand all/i }));
    expect(await screen.findByText(LONG_ANSWER)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Collapse all/i }));
    await waitFor(() => expect(screen.queryByText(LONG_ANSWER)).toBeNull());
  });

  it("searches inside the transcript, not just by role", async () => {
    render(<SessionDetailPage />);

    fireEvent.change(screen.getByLabelText(/Search transcript/i), {
      target: { value: "needle" },
    });

    await waitFor(() => expect(screen.queryByText(/queue.drain/)).toBeNull());
    expect(screen.getByText(/tell me about the needle/)).toBeInTheDocument();
  });

  it("says how much of the transcript the search left on screen", async () => {
    render(<SessionDetailPage />);

    fireEvent.change(screen.getByLabelText(/Search transcript/i), {
      target: { value: "needle" },
    });

    await waitFor(() => expect(screen.getByText(/Showing 1 of 3 messages/i)).toBeInTheDocument());
  });

  it("copies the whole conversation, roles and all", async () => {
    render(<SessionDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: /Copy transcript/i }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    const copied = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
    expect(copied).toContain("Please triage the queue");
    expect(copied).toContain("queue.drain() -> ok");
    expect(copied.toLowerCase()).toContain("assistant");
  });

  it("copies what is on screen, so a filtered copy is the filtered conversation", async () => {
    render(<SessionDetailPage />);
    fireEvent.change(screen.getByLabelText(/Search transcript/i), {
      target: { value: "needle" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Copy transcript/i }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    const copied = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
    expect(copied).toContain("tell me about the needle");
    expect(copied).not.toContain("queue.drain() -> ok");
  });

  it("GUARD: the role chips still filter", () => {
    render(<SessionDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: /1 tool/i }));

    expect(screen.queryByText(/tell me about the needle/)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// D40 — a capped transcript says it was capped
// ═══════════════════════════════════════════════════════════════

describe("a truncated transcript admits it", () => {
  it("says the reader is looking at the most recent messages only", () => {
    mockUseSessionDetail.mockReturnValue(loaded({ truncated: true }));

    render(<SessionDetailPage />);

    expect(screen.getByText(/most recent 3 messages/i)).toBeInTheDocument();
  });

  it("GUARD: says nothing of the sort when the whole transcript is on screen", () => {
    render(<SessionDetailPage />);

    expect(screen.queryByText(/most recent/i)).toBeNull();
  });
});
