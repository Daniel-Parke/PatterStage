/**
 * @jest-environment jsdom
 */
// ═══════════════════════════════════════════════════════════════
// T-0042 acceptance oracle, page half.
//
// The claim is not "the total is passed through". A number that happens to
// be right today is passed through by the same wiring that was wrong
// yesterday. The claim is that the tile CANNOT disagree with the header
// above it, and it is held two ways:
//
//   1. Compile time. SessionInsights must not be able to receive the loaded
//      page at all. tsconfig.tests.json type-checks this file and
//      `npm run lint` runs it, so the @ts-expect-error below is a real gate:
//      if the component still takes a `sessions` array the directive is
//      unused and the typecheck fails.
//
//   2. Behaviour. The real Sessions page is rendered against payloads whose
//      loaded page is deliberately unrepresentative of the table it came
//      from, and the number printed in the header is read out of the DOM and
//      compared with the number printed in the tile. A page-scoped tile
//      shows the page size (or nothing at all, on an empty page) and fails.
//
// Authored before any file under src/ was edited. Every case below was red
// on write.
// ═══════════════════════════════════════════════════════════════

import "@testing-library/jest-dom";
import type { ComponentProps } from "react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { renderWithQuery } from "../helpers/render-with-query";
import SessionsPage from "@/app/results/sessions/page";
import SessionInsights from "@/components/session/SessionInsights";
import type { SessionRecord } from "@/lib/sessions/session-repository";

// ── Payload fixtures ────────────────────────────────────────

interface Totals {
  total: number;
  active: number;
  messages: number;
  bySource: Record<string, number>;
}

interface Payload {
  sessions: SessionRecord[];
  total: number;
  totals: Totals;
  /** The filter buttons come from the API now (T-0105, D29). */
  sources: string[];
}

function pageRow(i: number): SessionRecord {
  // Every loaded row is a completed `api` session with no messages, so any
  // figure computed from the page reads 0 (or 50, for a count of rows).
  return {
    id: `page-${String(i).padStart(3, "0")}`,
    agentType: "hermes",
    source: "api",
    missionId: null,
    profileName: null,
    modelId: null,
    provider: null,
    title: `Routine api call ${i}`,
    size: 0,
    startedAt: new Date(Date.UTC(2026, 7, 26, 12, 0, 0) - i * 60_000).toISOString(),
    endedAt: new Date(Date.UTC(2026, 7, 26, 12, 0, 30) - i * 60_000).toISOString(),
    status: "completed",
    exitCode: 0,
    error: null,
    messageCount: 0,
  };
}

function payload(rows: number, totals: Totals): Payload {
  return {
    sessions: Array.from({ length: rows }, (_, i) => pageRow(i)),
    total: totals.total,
    totals,
            sources: ["cli", "api"],
  };
}

/** The whole table, of which the loaded page shows nothing representative. */
const WHOLE_TABLE: Totals = {
  total: 35_790,
  active: 214,
  messages: 918_442,
  bySource: { cli: 21_004, mission: 9_120, cron: 3_401, api: 2_262, subagent: 3 },
};

/** The same table narrowed to one source, as the filtered fetch would answer. */
const CLI_ONLY: Totals = {
  total: 21_004,
  active: 118,
  messages: 640_113,
  bySource: { cli: 21_004 },
};

// ── Fetch stub ──────────────────────────────────────────────

const originalFetch = global.fetch;

function serve(byQuery: (url: string) => Payload): void {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const body =
      url.startsWith("/api/monitor")
        ? // A configured agent, so AgentSetupNotice renders nothing.
          { data: { framework: { type: "hermes", name: "Hermes", available: true } } }
        : { data: byQuery(url) };
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }) as typeof global.fetch;
}

afterEach(() => {
  global.fetch = originalFetch;
  window.localStorage.clear();
});

// ── DOM readers ─────────────────────────────────────────────

/** The number the page header prints, which is the real COUNT(*). */
function headerNumber(): number {
  const el = screen.getByText(/recorded sessions across all agents$/);
  return digits(el.textContent);
}

/**
 * The insights strip, anchored on its own TOTAL label so the reader cannot
 * drift onto the source-filter buttons or a session row badge.
 */
function strip(): HTMLElement {
  const anchor = screen.getByText("Total");
  const found = anchor.closest(".animate-float-in");
  if (!found) throw new Error("insights strip not found around the TOTAL tile");
  return found as HTMLElement;
}

/** The text printed on the tile carrying `label`, exactly as a reader sees it. */
function tileText(label: string): string {
  const labelEl = within(strip()).getByText(label);
  const tile = labelEl.parentElement?.parentElement;
  const value = tile?.querySelector(".font-mono");
  if (!value) throw new Error(`no value found on the ${label} tile`);
  return (value.textContent ?? "").trim();
}

/** The number printed on the tile carrying `label`. */
function tileNumber(label: string): number {
  return digits(tileText(label));
}

function digits(text: string | null): number {
  const match = (text ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!match) throw new Error(`no number in ${JSON.stringify(text)}`);
  return Number(match[0]);
}

// ── 1. Compile-time impossibility ───────────────────────────

describe("SessionInsights cannot be handed the loaded page", () => {
  it("does not accept a page of sessions as a prop", () => {
    const props: ComponentProps<typeof SessionInsights> = {
      totals: WHOLE_TABLE,
      // @ts-expect-error -- the strip must not be able to see the loaded
      // page, because a strip that can see it is a strip that can count it.
      sessions: [pageRow(0)],
    };
    renderWithQuery(<SessionInsights {...props} />);
    expect(tileNumber("Total")).toBe(WHOLE_TABLE.total);
  });
});

// ── 2. Behavioural agreement ────────────────────────────────

describe("every tile agrees with the header above it", () => {
  it("prints the table's total, not the page's row count", async () => {
    serve(() => payload(50, WHOLE_TABLE));
    renderWithQuery(<SessionsPage />);

    await waitFor(() => expect(headerNumber()).toBe(WHOLE_TABLE.total));

    expect(tileNumber("Total")).toBe(headerNumber());
    expect(tileNumber("Total")).not.toBe(50);
  });

  it("prints whole-table ACTIVE, MESSAGES and CLI, none of which are on the page", async () => {
    serve(() => payload(50, WHOLE_TABLE));
    renderWithQuery(<SessionsPage />);

    await waitFor(() => expect(headerNumber()).toBe(WHOLE_TABLE.total));

    // The loaded page holds no active session, no message and no cli row, so
    // each of these reads 0 if it is computed from the page.
    expect(tileNumber("Active")).toBe(WHOLE_TABLE.active);
    expect(tileNumber("CLI")).toBe(WHOLE_TABLE.bySource.cli);
    // MESSAGES is the one tile drawn compactly, so it is pinned as the string
    // a reader actually sees rather than as a parsed figure.
    expect(tileText("Messages")).toBe("918k");
    expect(tileText("Messages")).not.toBe("0");
  });

  it("still shows the table when the loaded page is empty", async () => {
    // A page index past the end of a filtered result: nothing loaded, but
    // 35,790 sessions still exist and the header still says so.
    serve(() => payload(0, WHOLE_TABLE));
    renderWithQuery(<SessionsPage />);

    await waitFor(() => expect(headerNumber()).toBe(WHOLE_TABLE.total));

    expect(tileNumber("Total")).toBe(headerNumber());
    expect(tileNumber("Active")).toBe(WHOLE_TABLE.active);
  });

  it("follows the header when a source filter narrows both", async () => {
    serve((url) => (url.includes("source=cli") ? payload(50, CLI_ONLY) : payload(50, WHOLE_TABLE)));
    renderWithQuery(<SessionsPage />);

    await waitFor(() => expect(headerNumber()).toBe(WHOLE_TABLE.total));
    expect(tileNumber("Total")).toBe(WHOLE_TABLE.total);

    fireEvent.click(screen.getByRole("button", { name: "CLI" }));

    await waitFor(() => expect(headerNumber()).toBe(CLI_ONLY.total));
    expect(tileNumber("Total")).toBe(headerNumber());
    expect(tileNumber("Active")).toBe(CLI_ONLY.active);
  });

  it.each([
    ["a table barely larger than a page", { total: 51, active: 1, messages: 7, bySource: { cli: 51 } }],
    ["a table smaller than a page", { total: 3, active: 3, messages: 0, bySource: { cli: 3 } }],
    ["one active session", { total: 1, active: 1, messages: 2, bySource: { mission: 1 } }],
  ])("holds for %s", async (_label, totals: Totals) => {
    serve(() => payload(Math.min(totals.total, 50), totals));
    renderWithQuery(<SessionsPage />);

    await waitFor(() => expect(headerNumber()).toBe(totals.total));

    expect(tileNumber("Total")).toBe(headerNumber());
    expect(tileNumber("Active")).toBe(totals.active);
  });

  it("says nothing at all when there is nothing to count", async () => {
    serve(() => payload(0, { total: 0, active: 0, messages: 0, bySource: {} }));
    renderWithQuery(<SessionsPage />);

    await screen.findByText("No sessions found");
    expect(headerNumber()).toBe(0);
    // A strip of zeroes is noise, not information.
    expect(screen.queryByText("Total")).toBeNull();
  });
});
