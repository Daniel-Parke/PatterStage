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

import LogsPage from "@/app/(main)/logs/page";

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
