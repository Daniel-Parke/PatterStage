/** @jest-environment jsdom */

// T-0071 · F8, the half the route fix does not cover.
//
// FOUND BY MUTATION, and it is the whole point of the change. Setting
// `errorBody: null` in useApiResource, or dropping the page's
// `?? errorAvailableLogs(errorBody)`, left every other assertion green:
// logs-404-can-self-correct proves the ROUTE sends the list, and nothing at all
// proved anyone reads it.
//
// That is the Batch 3 lesson repeating -- a better response nobody reads is not
// an improvement -- and the seam-blindness of T-0068 and T-0070 in a third
// place: both ends covered, the strip between them not.
//
// The page starts at a hard-coded activeLog of "agent". On an install whose logs
// directory holds anything else, the first request 404s. What has to happen next
// is that the page picks a real file and asks for THAT, and the only observable
// proof is the name it asks for on the next render.

import { render, waitFor } from "@testing-library/react";

const mockUseLogs = jest.fn();
jest.mock("@/hooks/useLogs", () => ({ useLogs: (...a: unknown[]) => mockUseLogs(...a) }));

jest.mock("@/hooks/useTwoStepConfirm", () => ({
  useTwoStepConfirm: () => ({
    isArmed: false,
    arm: jest.fn(),
    confirm: jest.fn(),
    cancel: jest.fn(),
  }),
}));
jest.mock("@/lib/api-fetch", () => ({
  safeApiCallData: jest.fn(),
  setErrorFromCaught: jest.fn(),
}));

import LogsPage from "@/app/results/logs/page";

const AVAILABLE = [
  { name: "hermes", size: 10, modified: "2026-08-31T11:00:00Z" },
  { name: "gateway", size: 20, modified: "2026-08-31T11:00:00Z" },
];

/** What the hook returns for a 404 that carried the file list. */
function notFoundWithList() {
  return {
    data: null,
    isLoading: false,
    isFetching: false,
    error: "Log file 'agent.log' not found",
    errorBody: { availableLogs: AVAILABLE },
    refetch: jest.fn(),
  };
}

/** The names the page has asked for, in order. */
const requested = () => mockUseLogs.mock.calls.map((c) => c[0] as string);

beforeEach(() => jest.clearAllMocks());

describe("a 404 on the default log name does not strand the page", () => {
  it("asks for a real file on the next render", async () => {
    mockUseLogs.mockReturnValue(notFoundWithList());

    render(<LogsPage />);

    // First ask is the hard-coded default; the effect then corrects it.
    expect(requested()[0]).toBe("agent");
    await waitFor(() => expect(requested()).toContain("hermes"));
  });

  it("keeps reporting the error while it corrects itself", async () => {
    // The recovery must not read as success. The list is recovery DATA; the
    // request still failed, and a page that quietly rendered as though nothing
    // were wrong would be a different lie.
    mockUseLogs.mockReturnValue(notFoundWithList());

    const { container } = render(<LogsPage />);

    await waitFor(() => expect(requested()).toContain("hermes"));
    expect(container.textContent).toMatch(/not found/i);
  });

  it("stops once it is asking for a name that exists", async () => {
    // No loop: when the active name IS in the list, the effect must not keep
    // reassigning. A 5s poll plus a self-retriggering effect is a spin.
    mockUseLogs.mockReturnValue({
      ...notFoundWithList(),
      errorBody: { availableLogs: [{ name: "agent", size: 1, modified: "x" }] },
    });

    render(<LogsPage />);
    await waitFor(() => expect(requested().length).toBeGreaterThan(0));

    expect(new Set(requested())).toEqual(new Set(["agent"]));
  });

  it("does nothing when the failure carried no list", async () => {
    // A 500, or a 404 from some other route shape. There is nothing to correct
    // to, and inventing a name would be worse than staying put.
    mockUseLogs.mockReturnValue({
      ...notFoundWithList(),
      error: "Network error",
      errorBody: null,
    });

    render(<LogsPage />);
    await waitFor(() => expect(requested().length).toBeGreaterThan(0));

    expect(new Set(requested())).toEqual(new Set(["agent"]));
  });

  it("does nothing when the failure body is not a list at all", async () => {
    // Found by mutation: dropping the Array.isArray check left everything green,
    // because the only "no list" case tested was a null body — which returns
    // early before the check. This is the one that reaches it. A failure body is
    // schema-checked nowhere, so a route answering `{availableLogs: "none"}`
    // would otherwise crash the effect on `.some`.
    mockUseLogs.mockReturnValue({
      ...notFoundWithList(),
      errorBody: { availableLogs: "none" },
    });

    render(<LogsPage />);
    await waitFor(() => expect(requested().length).toBeGreaterThan(0));

    expect(new Set(requested())).toEqual(new Set(["agent"]));
  });

  it("GREEN CONTROL: a successful read still drives the same correction", async () => {
    // The pre-existing behaviour, which the change must not have broken: a 200
    // whose availableLogs does not include the active name also re-points it.
    mockUseLogs.mockReturnValue({
      data: { name: "agent", lines: [], availableLogs: AVAILABLE, totalLines: 0, showingLines: 0, size: 0, modified: "x" },
      isLoading: false,
      isFetching: false,
      error: null,
      errorBody: null,
      refetch: jest.fn(),
    });

    render(<LogsPage />);

    await waitFor(() => expect(requested()).toContain("hermes"));
  });
});

describe("a 404 is shown as an error, not as an empty state", () => {
  it("renders the reason when the logs directory does not exist", async () => {
    // Driving the product in a browser found this: on a fresh install /logs
    // answers 404 "No logs directory found" and the page showed only "No
    // matching log files" -- an ERROR rendered as an EMPTY STATE, which the
    // operator cannot tell from "you simply have no logs yet".
    mockUseLogs.mockReturnValue({
      data: null,
      isLoading: false,
      isFetching: false,
      error: "No logs directory found. The agent has not written any logs yet.",
      errorBody: { availableLogs: [], logsDirMissing: true },
      refetch: jest.fn(),
    });

    const { container } = render(<LogsPage />);

    await waitFor(() => expect(requested().length).toBeGreaterThan(0));
    // A visible live region carrying the reason. The role was "alert" when
    // T-0079 wrote this; T-0087 made the fresh-install case a calm "status",
    // because a normal condition in a red banner is the other kind of lie.
    expect(container.querySelector('[role="alert"], [role="status"]')).not.toBeNull();
    expect(container.textContent).toMatch(/no logs directory/i);
  });

  it("an empty logs directory is the same calm status (T-0087)", async () => {
    mockUseLogs.mockReturnValue({
      data: null,
      isLoading: false,
      isFetching: false,
      error: "No log files yet. The agent has not written any logs - this is normal on a fresh install.",
      errorBody: { availableLogs: [], noLogsYet: true },
      refetch: jest.fn(),
    });

    const { container } = render(<LogsPage />);

    await waitFor(() => expect(requested().length).toBeGreaterThan(0));
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("a fresh install is a calm status, not a red alert (T-0087)", async () => {
    // Round 6 nuance on finding 20: T-0079's message reached the page, but as
    // an error banner, and the logsDirMissing flag the route sends was payload
    // nothing read. Same information, honest tone: role=status, no alert.
    mockUseLogs.mockReturnValue({
      data: null,
      isLoading: false,
      isFetching: false,
      error: "No logs directory found. The agent has not written any logs yet - this is normal on a fresh install.",
      errorBody: { availableLogs: [], logsDirMissing: true },
      refetch: jest.fn(),
    });

    const { container } = render(<LogsPage />);

    await waitFor(() => expect(requested().length).toBeGreaterThan(0));
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toMatch(/normal on a fresh install/i);
  });

  it("does not sit on an empty file list with nothing said", async () => {
    // The specific confusion: "No matching log files" is the picker's empty
    // state, and on its own it reads as good news.
    mockUseLogs.mockReturnValue({
      data: null,
      isLoading: false,
      isFetching: false,
      error: "No logs directory found.",
      errorBody: { availableLogs: [] },
      refetch: jest.fn(),
    });

    const { container } = render(<LogsPage />);

    await waitFor(() => expect(requested().length).toBeGreaterThan(0));
    const hasEmptyState = /no matching log files/i.test(container.textContent ?? "");
    const hasError = container.querySelector('[role="alert"]') !== null;
    expect(hasEmptyState && !hasError).toBe(false);
  });
});
