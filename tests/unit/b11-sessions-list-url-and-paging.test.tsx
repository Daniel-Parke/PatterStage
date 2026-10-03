/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B11 oracle, the list shell (T-0105, contract §1 §2 §3 §8 §10).
//
// Written before the product code moved. What each case pins:
//
//   D37  search, source and page are plain useState. The core loop of this
//        page — search 35,790 sessions, page to row 400, open a transcript,
//        hit Back — returns to an unfiltered page 1, and there is no URL to
//        send anyone. The three live in the query string, read on mount and
//        mirrored on every change.
//   D39  Prev/Next over 716 pages, with no First, no Last and no page size.
//   D29  The source filter offers the four names the badge map knows.
//        `subagent` and `tui` rows exist in the operator's database and can
//        be neither seen nor filtered; the buttons come from the API.
//   D30  There is no way to ask for the failed sessions.
//   D31  The noise filter runs in the browser over the loaded page, so the
//        count line and the tiles describe a different set from the rows.
//        The toggle becomes a parameter on the request.
//
// The page is rendered for real against a stubbed fetch, so what is asserted
// is the URL the page asks for and the URL it leaves behind — the two things
// a shareable, back-navigable list view is made of.
// ═══════════════════════════════════════════════════════════════

import { fireEvent, screen, waitFor } from "@testing-library/react";

import { renderWithQuery } from "../helpers/render-with-query";
import SessionsPage from "@/app/results/sessions/page";
import type { SessionRecord } from "@/lib/sessions/session-repository";

const originalFetch = global.fetch;
let requested: string[] = [];

function row(i: number, over: Partial<Omit<SessionRecord, "source">> & { source?: string } = {}): SessionRecord {
  return {
    id: `sess-${i}`,
    agentType: "hermes",
    source: "cli",
    missionId: null,
    profileName: null,
    modelId: null,
    provider: null,
    title: `Session ${i}`,
    size: 2048,
    startedAt: new Date(Date.UTC(2026, 8, 5, 12, 0, 0) - i * 60_000).toISOString(),
    endedAt: new Date(Date.UTC(2026, 8, 5, 12, 30, 0) - i * 60_000).toISOString(),
    status: "completed",
    exitCode: 0,
    error: null,
    messageCount: 3,
    ...over,
  } as unknown as SessionRecord;
}

/** 500 rows in the table, four sources in it, two of which have no badge. */
const TOTALS = {
  total: 500,
  active: 0,
  messages: 1200,
  bySource: { cli: 300, api: 100, subagent: 60, tui: 40 },
};

const SOURCES = ["api", "cli", "subagent", "tui"];

function serve(): void {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    requested.push(url);
    const body = url.startsWith("/api/monitor")
      ? { data: { framework: { type: "hermes", name: "Hermes", available: true } } }
      : {
          data: {
            sessions: [row(0), row(1, { source: "subagent" })],
            total: TOTALS.total,
            totals: TOTALS,
            sources: SOURCES,
          },
        };
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }) as typeof global.fetch;
}

/** Every /api/sessions URL the page has asked for, newest last. */
function sessionRequests(): string[] {
  return requested.filter((u) => u.startsWith("/api/sessions"));
}

function lastSessionRequest(): string {
  const all = sessionRequests();
  return all[all.length - 1] ?? "";
}

async function renderList(query = ""): Promise<void> {
  window.history.replaceState(null, "", `/results/sessions${query}`);
  renderWithQuery(<SessionsPage />);
  await waitFor(() => expect(sessionRequests().length).toBeGreaterThan(0));
  await screen.findByText(/Session 0/);
}

beforeEach(() => {
  requested = [];
  window.localStorage.clear();
  serve();
});

afterEach(() => {
  global.fetch = originalFetch;
  window.history.replaceState(null, "", "/results/sessions");
  window.localStorage.clear();
});

// ═══════════════════════════════════════════════════════════════
// D37 — the view is in the URL, both ways
// ═══════════════════════════════════════════════════════════════

describe("the list view can be restored from its own URL", () => {
  it("asks the API for what the query string describes", async () => {
    await renderList("?search=alpha&source=subagent&page=3");

    await waitFor(() => {
      const url = lastSessionRequest();
      expect(url).toContain("search=alpha");
      expect(url).toContain("source=subagent");
      // page 3 of 50 starts at row 100. A page index read as 0 asks for 0.
      expect(url).toContain("offset=100");
    });
  });

  it("GUARD: survives junk in the page parameter rather than asking for row NaN", async () => {
    await renderList("?page=not-a-number");

    expect(lastSessionRequest()).toContain("offset=0");
  });

  it("writes the page number back so Back returns to it", async () => {
    await renderList();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(window.location.search).toMatch(/(\?|&)page=2(&|$)/));
  });

  it("writes the search term back", async () => {
    await renderList();

    fireEvent.change(screen.getByLabelText(/Search sessions/i), {
      target: { value: "quasar" },
    });

    await waitFor(() => expect(window.location.search).toContain("search=quasar"));
  });

  it("writes the source filter back, and clearing it takes it out again", async () => {
    await renderList();

    fireEvent.click(screen.getByRole("button", { name: /^CLI$/ }));
    await waitFor(() => expect(window.location.search).toContain("source=cli"));

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    await waitFor(() => expect(window.location.search).not.toContain("source="));
  });

  it("GUARD: a plain first load still asks for the first page of fifty", async () => {
    await renderList();

    const first = sessionRequests()[0];
    expect(first).toContain("limit=50");
    expect(first).toContain("offset=0");
  });
});

// ═══════════════════════════════════════════════════════════════
// D29 / D30 / D31 — the filters the request can carry
// ═══════════════════════════════════════════════════════════════

describe("the filter bar offers the sources that exist", () => {
  it("offers a source the badge map has no word for", async () => {
    await renderList();

    expect(screen.getByRole("button", { name: /Subagent/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /TUI/ })).toBeInTheDocument();
  });

  it("filters by it", async () => {
    await renderList();

    fireEvent.click(screen.getByRole("button", { name: /Subagent/ }));

    await waitFor(() => expect(lastSessionRequest()).toContain("source=subagent"));
  });

  it("keeps offering the others while one is in force", async () => {
    await renderList("?source=cli");

    expect(screen.getByRole("button", { name: /Subagent/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^API$/ })).toBeInTheDocument();
  });
});

describe("the failed sessions can be asked for", () => {
  it("sends the status filter to the API and remembers it in the URL", async () => {
    await renderList();

    fireEvent.click(screen.getByRole("button", { name: "Failed" }));

    await waitFor(() => expect(lastSessionRequest()).toContain("status=failed"));
    expect(window.location.search).toContain("status=failed");
  });

  it("is restored from the URL", async () => {
    await renderList("?status=failed");

    expect(lastSessionRequest()).toContain("status=failed");
    expect(screen.getByRole("button", { name: "Failed" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("hiding API noise is the server's job", () => {
  it("asks the API to leave it out, so the count and the rows agree", async () => {
    await renderList();

    fireEvent.click(screen.getByRole("button", { name: /Hide API noise/ }));

    await waitFor(() => expect(lastSessionRequest()).toContain("hideApiNoise=1"));
  });

  it("GUARD: it is off until it is asked for", async () => {
    await renderList();

    expect(lastSessionRequest()).not.toContain("hideApiNoise");
  });
});

// ═══════════════════════════════════════════════════════════════
// D39 — paging a 716-page history
// ═══════════════════════════════════════════════════════════════

describe("pagination can reach the ends of the history", () => {
  it("jumps to the last page", async () => {
    await renderList();

    fireEvent.click(screen.getByRole("button", { name: "Last" }));

    // 500 rows, 50 to a page: the tenth page starts at row 450.
    await waitFor(() => expect(lastSessionRequest()).toContain("offset=450"));
  });

  it("jumps back to the first", async () => {
    await renderList("?page=7");

    fireEvent.click(screen.getByRole("button", { name: "First" }));

    await waitFor(() => expect(lastSessionRequest()).toContain("offset=0"));
  });

  it("does not offer First or Previous from the first page", async () => {
    await renderList();

    expect(screen.getByRole("button", { name: "First" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("does not offer Last or Next from the last page", async () => {
    await renderList("?page=10");

    expect(screen.getByRole("button", { name: "Last" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("takes a page size, and starts the smaller page from the top", async () => {
    await renderList("?page=4");

    fireEvent.change(screen.getByLabelText(/Rows per page/i), { target: { value: "100" } });

    await waitFor(() => {
      const url = lastSessionRequest();
      expect(url).toContain("limit=100");
      expect(url).toContain("offset=0");
    });
    expect(window.location.search).toContain("size=100");
  });
});
