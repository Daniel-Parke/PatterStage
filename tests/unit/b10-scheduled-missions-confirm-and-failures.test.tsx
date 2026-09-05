/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B10 oracle, group missions (D73).
//
// Written before the product code moved. Holds contract section 4.
//
// The defect, both halves:
//
//   1. `onClick={() => remove.mutate(s.id)}` deletes a schedule on the FIRST
//      click. Every other destructive action in this area is two clicks — the
//      mission delete, the mission cancel, the template delete — so this is
//      both the riskiest click on the page and the only one that does not ask.
//   2. useSchedules' toggle, remove and runNow mutations never look at
//      `res.ok`. safeApiCall does not throw, so a refused DELETE, a refused
//      PATCH and a refused run-now are all indistinguishable from success: the
//      row is invalidated, refetched, comes back unchanged, and nothing on the
//      screen ever says the write was turned down.
//
// The contract: the delete is a ConfirmButton (one instance per row, never
// disabled by being armed), the three mutations throw on a refusal so TanStack
// routes them to onError, and the section renders what came back. Plus the
// anchor the mission panel's "Edit schedule" link targets.
// ═══════════════════════════════════════════════════════════════

import { fireEvent, screen, waitFor } from "@testing-library/react";

import { renderWithQuery } from "../helpers/render-with-query";

// ── the wire ───────────────────────────────────────────────────

interface CallResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

const calls: Array<{ path: string; method: string }> = [];
const answers = new Map<string, CallResult>();

const safeApiCall = jest.fn(async (path: string, options?: { method?: string }) => {
  const method = options?.method ?? "GET";
  calls.push({ path, method });
  return answers.get(`${method} ${path}`) ?? { ok: true, data: {} };
});

jest.mock("@/lib/api-fetch", () => ({
  ...(jest.requireActual("@/lib/api-fetch") as Record<string, unknown>),
  safeApiCall: (...a: unknown[]) => (safeApiCall as unknown as (...a: unknown[]) => unknown)(...a),
}));

import ScheduledMissions from "@/components/missions/ScheduledMissions";

// ── fixtures ───────────────────────────────────────────────────

const SCHEDULE = {
  id: "sch-1",
  missionId: "m-1",
  name: "Nightly digest",
  schedule: "every 30m",
  scheduleDisplay: "every 30 minutes",
  enabled: true,
  catchUpPolicy: "fire_once",
  repeatTimes: null,
  repeatDone: 0,
  profileName: null,
  nextRunAt: "2099-01-01T00:00:00.000Z",
  lastRunAt: null,
  lastRunId: null,
  lastStatus: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

function deleteButton(): HTMLElement {
  return screen.getByRole("button", { name: /delete the schedule/i });
}

function called(method: string, path: string): boolean {
  return calls.some((c) => c.method === method && c.path === path);
}

async function mount() {
  const view = renderWithQuery(<ScheduledMissions />);
  await screen.findByText("Nightly digest");
  return view;
}

beforeEach(() => {
  calls.length = 0;
  answers.clear();
  safeApiCall.mockClear();
  answers.set("GET /api/schedules", { ok: true, data: { data: { schedules: [SCHEDULE] } } });
  answers.set("GET /api/missions?limit=500", { ok: true, data: { data: { missions: [] } } });
});

// ── the anchor ─────────────────────────────────────────────────

describe("the section the mission panel links to", () => {
  it("carries the id that 'Edit schedule' targets", async () => {
    const { container } = await mount();

    expect(container.querySelector("#scheduled-missions")).not.toBeNull();
  });
});

// ── two clicks ─────────────────────────────────────────────────

describe("deleting a schedule takes two clicks", () => {
  it("does not delete on the first click; it arms", async () => {
    await mount();

    fireEvent.click(deleteButton());

    expect(called("DELETE", "/api/schedules/sch-1")).toBe(false);
    // The house primitive marks its armed state on the element itself.
    expect(deleteButton()).toHaveAttribute("data-armed", "true");
  });

  it("is not disabled by being armed, which is the whole point of the primitive", async () => {
    await mount();

    fireEvent.click(deleteButton());

    expect(deleteButton()).not.toBeDisabled();
  });

  it("deletes on the second click", async () => {
    await mount();

    fireEvent.click(deleteButton());
    fireEvent.click(deleteButton());

    await waitFor(() => expect(called("DELETE", "/api/schedules/sch-1")).toBe(true));
  });
});

// ── failures are audible ───────────────────────────────────────

describe("a refused write says so", () => {
  it("shows the server's reason when a delete is refused", async () => {
    answers.set("DELETE /api/schedules/sch-1", { ok: false, error: "Schedule is locked" });
    await mount();

    fireEvent.click(deleteButton());
    fireEvent.click(deleteButton());

    expect(await screen.findByText("Schedule is locked")).toBeInTheDocument();
  });

  it("falls back to its own wording when the server gives no reason", async () => {
    answers.set("DELETE /api/schedules/sch-1", { ok: false });
    await mount();

    fireEvent.click(deleteButton());
    fireEvent.click(deleteButton());

    expect(await screen.findByText("Failed to delete the schedule")).toBeInTheDocument();
  });

  it("shows a refused pause", async () => {
    answers.set("PATCH /api/schedules/sch-1", { ok: false, error: "Scheduler is read-only" });
    await mount();

    fireEvent.click(screen.getByRole("button", { name: /^pause$/i }));

    expect(await screen.findByText("Scheduler is read-only")).toBeInTheDocument();
  });

  it("falls back to its own wording for a refused pause", async () => {
    answers.set("PATCH /api/schedules/sch-1", { ok: false });
    await mount();

    fireEvent.click(screen.getByRole("button", { name: /^pause$/i }));

    expect(await screen.findByText("Failed to update the schedule")).toBeInTheDocument();
  });

  it("shows a refused run-now instead of a Run button that does nothing", async () => {
    answers.set("POST /api/schedules/sch-1/run", { ok: false, error: "Another mission is running" });
    await mount();

    fireEvent.click(screen.getByRole("button", { name: /^run$/i }));

    expect(await screen.findByText("Another mission is running")).toBeInTheDocument();
  });

  it("falls back to its own wording for a refused run-now", async () => {
    answers.set("POST /api/schedules/sch-1/run", { ok: false });
    await mount();

    fireEvent.click(screen.getByRole("button", { name: /^run$/i }));

    expect(await screen.findByText("Failed to start the run")).toBeInTheDocument();
  });

  it("GREEN CONTROL: says nothing when the write lands", async () => {
    await mount();

    fireEvent.click(screen.getByRole("button", { name: /^pause$/i }));

    await waitFor(() => expect(called("PATCH", "/api/schedules/sch-1")).toBe(true));
    expect(screen.queryByText(/^Failed to/)).not.toBeInTheDocument();
  });
});
