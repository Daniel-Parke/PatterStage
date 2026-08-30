/** @jest-environment jsdom */
/**
 * T-0051 acceptance oracle — the composer finishes what it starts.
 *
 * The live QA pass reported "the New Mission dialog stays after a successful
 * create" and read the missing toast as a missing `showToast` call. Both halves
 * of that were wrong in an interesting way.
 *
 * The toast fires every time. It was rendering UNDERNEATH the sheet, which
 * T-0050 fixed. What remains, and what this file is about, is that the sheet
 * itself closes on only some branches:
 *
 *   create + save    closes, via resetForm()
 *   create + queue   closes, via resetForm()
 *   create + now     DOES NOT CLOSE
 *   create + cron    DOES NOT CLOSE
 *   edit  + update   closes, via closeComposer() + resetForm()
 *   edit  + promote  closes
 *   edit  + redispatch (a completed mission)  DOES NOT CLOSE
 *
 * There is no single "finish" step. `resetForm()` and `closeComposer()` are two
 * different ways to end, chosen per branch, so three branches ended up choosing
 * neither. Every one of those three also calls setExpandedId / fetchDetail,
 * which expands a row on the board BEHIND the still-open sheet, so the one
 * remaining piece of visual confirmation is occluded too.
 *
 * Three further defects in the same path, none of them reported:
 *
 *   · `setEditingId(null)` runs BEFORE the await, so mid-flight the sheet title
 *     flips from "Edit Mission" to "New Mission" and the dispatch gate can
 *     re-arm. If the request then fails, the operator is left in a
 *     create-shaped composer holding edit data.
 *   · `if (!isCompleted) return;` returns with no toast and no state change: a
 *     button that does nothing and says nothing.
 *   · `newSchedule` is not cleared by the form reset, so the next New Mission
 *     opens showing the previous mission's cron.
 */

import { act, renderHook } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";

import { useMissionDispatch } from "@/hooks/useMissionDispatch";

const dispatchMissionAction = jest.fn();
jest.mock("@/hooks/success-message-for-dispatch", () => ({
  ...jest.requireActual("@/hooks/success-message-for-dispatch"),
  dispatchMissionAction: (...args: unknown[]) => dispatchMissionAction(...(args as [])),
}));

type Mode = "save" | "queue" | "now" | "cron";

function harness(
  opts: {
    mode?: Mode;
    editingId?: string | null;
    missions?: unknown[];
    scheduleDraftError?: string | null;
  } = {},
) {
  const setShowCreate = jest.fn();
  const closeComposer = jest.fn();
  const clearMissionFormFields = jest.fn();
  const setEditingId = jest.fn();
  const showToast = jest.fn();
  const fetchData = jest.fn(async () => undefined);
  const fetchDetail = jest.fn(async () => undefined);

  const composer = {
    newName: "QA mission",
    newInstruction: "do the thing",
    dispatchAcknowledged: true,
    setDispatchAcknowledged: jest.fn(),
    newDispatch: opts.mode ?? "save",
    setNewDispatch: jest.fn(),
    newSchedule: "5 1 * * *",
    scheduleDraftError: opts.scheduleDraftError ?? null,
    dispatchPayload: jest.fn(() => ({ instruction: "do the thing" })),
    clearMissionFormFields,
    populateFormFromMission: jest.fn(),
  };

  const { result } = renderHook(() =>
    useMissionDispatch({
      // The hook takes every collaborator by injection, which is what makes
      // this testable at all.
      composer: composer as never,
      missions: (opts.missions ?? []) as never,
      updateMission: jest.fn(),
      fetchData,
      fetchDetail,
      expandedId: null,
      setExpandedId: jest.fn(),
      editingId: opts.editingId ?? null,
      setEditingId,
      setShowCreate,
      closeComposer,
      showToast,
    }),
  );

  return { result, setShowCreate, closeComposer, clearMissionFormFields, setEditingId, showToast, fetchData };
}

beforeEach(() => {
  dispatchMissionAction.mockReset();
  dispatchMissionAction.mockResolvedValue({ ok: true, data: { mission: { id: "m1" } } });
});

describe("a successful create closes the composer", () => {
  const MODES: Mode[] = ["save", "queue", "now", "cron"];

  it.each(MODES)("closes after dispatchMode=%s", async (mode) => {
    const h = harness({ mode });
    await act(async () => {
      await h.result.current.handleCreate();
    });
    // Either ending is acceptable; ending is not optional. A branch that does
    // neither leaves the operator staring at a form they already submitted.
    const closed =
      h.setShowCreate.mock.calls.some(([v]) => v === false) || h.closeComposer.mock.calls.length > 0;
    expect(closed).toBe(true);
  });

  it("does not close when the request failed", async () => {
    dispatchMissionAction.mockResolvedValue({ ok: false, error: "boom" });
    const h = harness({ mode: "save" });
    await act(async () => {
      await h.result.current.handleCreate();
    });
    expect(h.setShowCreate).not.toHaveBeenCalledWith(false);
    expect(h.closeComposer).not.toHaveBeenCalled();
  });
});

describe("re-dispatching a completed mission", () => {
  const completed = [{ id: "done-1", name: "QA mission", status: "successful" }];

  it("closes the composer like every other successful path", async () => {
    const h = harness({ mode: "now", editingId: "done-1", missions: completed });
    await act(async () => {
      await h.result.current.handleCreate();
    });
    const closed =
      h.setShowCreate.mock.calls.some(([v]) => v === false) || h.closeComposer.mock.calls.length > 0;
    expect(closed).toBe(true);
  });

  it("clears the editing id only AFTER the request settles", async () => {
    // Clearing it first flips the sheet from "Edit Mission" to "New Mission"
    // mid-flight and can re-arm the dispatch gate; a failure then strands the
    // operator in a create-shaped composer holding edit data.
    let clearedBeforeRequest = false;
    const h = harness({ mode: "now", editingId: "done-1", missions: completed });
    dispatchMissionAction.mockImplementation(async () => {
      clearedBeforeRequest = h.setEditingId.mock.calls.some(([v]) => v === null);
      return { ok: true, data: { mission: { id: "m1" } } };
    });
    await act(async () => {
      await h.result.current.handleCreate();
    });
    expect(clearedBeforeRequest).toBe(false);
    expect(h.setEditingId).toHaveBeenCalledWith(null);
  });

  it("says something when the mission is not in the board", async () => {
    // `if (!isCompleted) return;` used to return with no toast and no state
    // change: a button that does nothing and explains nothing.
    const h = harness({ mode: "now", editingId: "ghost", missions: [] });
    await act(async () => {
      await h.result.current.handleCreate();
    });
    expect(h.showToast).toHaveBeenCalled();
  });
});

describe("the form does not leak into the next mission", () => {
  it("resets the form after a successful create", async () => {
    const h = harness({ mode: "save" });
    await act(async () => {
      await h.result.current.handleCreate();
    });
    expect(h.clearMissionFormFields).toHaveBeenCalled();
  });

  it("clears the schedule, not just the eleven fields beside it", () => {
    // `clearMissionFormFields` resets eleven fields and forgets `newSchedule`,
    // so the next New Mission opens holding the previous mission's cron. Read
    // from source: the setter list is the contract, and a schedule left behind
    // is a mission dispatched on a cadence nobody chose.
    const src = readFileSync(
      join(__dirname, "..", "..", "src", "hooks", "useMissionComposer.ts"),
      "utf-8",
    );
    const body = src.slice(
      src.indexOf("const clearMissionFormFields"),
      src.indexOf("const setCategoryId"),
    );
    expect(body).toMatch(/setNewSchedule\(/);
  });
});


// ── The seam, not the helper (T-0063) ───────────────────────────
//
// Added because a mutation survived. `scheduleBlocksDispatch` had unit tests and
// the picker had unit tests, and removing the gate from `handleCreate` entirely
// turned NOTHING red, because nothing asserted that handleCreate consults it.
// That is the same mistake as the test this batch deleted: cover the pieces,
// miss the join. These drive the real handler.
describe("a mission whose schedule was never usable is not dispatched", () => {
  it("fires no dispatch at all", async () => {
    const h = harness({ mode: "cron", scheduleDraftError: 'Not a schedule this understands: "x"' });
    await act(async () => {
      await h.result.current.handleCreate();
    });
    expect(dispatchMissionAction).not.toHaveBeenCalled();
  });

  it("keeps the composer open so the operator can fix it", async () => {
    const h = harness({ mode: "cron", scheduleDraftError: "bad" });
    await act(async () => {
      await h.result.current.handleCreate();
    });
    expect(h.closeComposer).not.toHaveBeenCalled();
    expect(h.clearMissionFormFields).not.toHaveBeenCalled();
  });

  it("says why, rather than returning silently", async () => {
    const h = harness({ mode: "cron", scheduleDraftError: 'Not a schedule this understands: "x"' });
    await act(async () => {
      await h.result.current.handleCreate();
    });
    expect(h.showToast).toHaveBeenCalledWith(
      expect.stringMatching(/not a schedule this understands/i),
      "error",
    );
  });

  it("never claims a cadence the operator did not type", async () => {
    const h = harness({ mode: "cron", scheduleDraftError: "bad" });
    await act(async () => {
      await h.result.current.handleCreate();
    });
    for (const call of h.showToast.mock.calls) {
      expect(String(call[0])).not.toMatch(/Mission scheduled/i);
      expect(String(call[0])).not.toMatch(/every 5m/i);
    }
  });

  it("still dispatches a mission that sends no schedule", async () => {
    // GREEN CONTROL, and load-bearing: it scopes the gate to the mode that
    // actually carries a schedule. Garbage left in a hidden advanced box must
    // not block a "run it now".
    const h = harness({ mode: "now", scheduleDraftError: "bad" });
    await act(async () => {
      await h.result.current.handleCreate();
    });
    expect(dispatchMissionAction).toHaveBeenCalled();
  });

  it("still dispatches once the draft is corrected", async () => {
    // The gate is not a one-way latch.
    const h = harness({ mode: "cron", scheduleDraftError: null });
    await act(async () => {
      await h.result.current.handleCreate();
    });
    expect(dispatchMissionAction).toHaveBeenCalled();
  });
});
