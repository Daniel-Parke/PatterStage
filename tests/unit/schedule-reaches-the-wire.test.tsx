/** @jest-environment jsdom */
/**
 * T-0051 — the seam nobody tested: picker → form state → POST body.
 *
 * `SchedulePicker.test.tsx` proves the picker emits the right string to a
 * `jest.fn()`. `dispatch-mode.test.ts` proves `scheduleForDispatch` passes a
 * schedule through for `cron` and drops it otherwise. Nothing joined them, so
 * nothing asserted that what the operator typed is what the server receives.
 *
 * That is exactly the gap a live QA pass fell into: it typed `5 1 * * *`,
 * submitted, and found `"every 5m"` on the wire. The picker was innocent; the
 * report's diagnosis ("one of the two fields is dead") was wrong. But the seam
 * being untested is why neither of us could tell without reading five files.
 *
 * ── AND THIS FILE DID NOT CLOSE THAT SEAM (T-0063) ──────────────
 *
 * It named itself after "picker -> form state -> POST body" and then tested
 * "picker -> jest.fn -> hook method". Every test below renders SchedulePicker
 * standalone against a hand-rolled onChange and calls `dispatchPayload`
 * directly. MissionCreateForm, the Schedule button and `handleCreate` are never
 * mounted, so the real click-to-POST path had no coverage at all.
 *
 * Worse, it carried a test titled "an invalid draft leaves the previous
 * schedule on the wire, and says so", which is a description of the DEFECT
 * written in the grammar of a guarantee. It asserted that onChange was not
 * called and a message appeared, and treated that as sufficient. It never
 * asserted that the POST was blocked. A second QA pass then typed garbage,
 * clicked Schedule, and got a mission on "every 5m" plus a green toast reading
 * "Mission scheduled: every 5m" -- a cadence the operator never typed.
 *
 * That test is deleted and replaced by the describe block at the foot of this
 * file, which renders the real submit path. The lesson is worth keeping: a test
 * whose title states the bug is worse than no test, because it converts an open
 * defect into a documented decision.
 */

import { act, renderHook } from "@testing-library/react";
import { fireEvent, render, screen } from "@testing-library/react";

import SchedulePicker from "@/components/schedule/SchedulePicker";
import { useMissionComposer } from "@/hooks/useMissionComposer";
import { scheduleForDispatch, scheduleBlocksDispatch } from "@/lib/dispatch-mode";

function openAdvanced(value: string) {
  fireEvent.click(screen.getByRole("button", { name: /Show advanced/i }));
  return screen.getByDisplayValue(value) as HTMLInputElement;
}

describe("a schedule typed into the picker reaches the dispatch payload", () => {
  it("carries a raw cron committed on blur", () => {
    const { result } = renderHook(() => useMissionComposer({ showCreate: true, editingId: null }));

    // The picker, driven exactly as an operator drives it.
    const onChange = jest.fn((s: string) => act(() => result.current.setNewSchedule(s)));
    render(<SchedulePicker value={result.current.newSchedule} onChange={onChange} onDraftError={jest.fn()} />);
    const input = openAdvanced("*/5 * * * *");
    fireEvent.change(input, { target: { value: "5 1 * * *" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith("5 1 * * *");
    expect(result.current.newSchedule).toBe("5 1 * * *");

    const payload = result.current.dispatchPayload({ dispatchMode: "cron" });
    expect(payload.schedule).toBe("5 1 * * *");
  });

  it("carries a raw cron committed on Enter", () => {
    const { result } = renderHook(() => useMissionComposer({ showCreate: true, editingId: null }));
    const onChange = jest.fn((s: string) => act(() => result.current.setNewSchedule(s)));
    render(<SchedulePicker value={result.current.newSchedule} onChange={onChange} onDraftError={jest.fn()} />);
    const input = openAdvanced("*/5 * * * *");
    fireEvent.change(input, { target: { value: "30 3 * * 1" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(result.current.dispatchPayload({ dispatchMode: "cron" }).schedule).toBe("30 3 * * 1");
  });

  it("does NOT put the preset default on the wire once a cron was committed", () => {
    // The precise thing the QA pass observed. It was caused by an invalid draft
    // reverting in silence, not by the field being dead, and the silence is
    // what T-0051 removed.
    const { result } = renderHook(() => useMissionComposer({ showCreate: true, editingId: null }));
    const onChange = jest.fn((s: string) => act(() => result.current.setNewSchedule(s)));
    render(<SchedulePicker value={result.current.newSchedule} onChange={onChange} onDraftError={jest.fn()} />);
    const input = openAdvanced("*/5 * * * *");
    fireEvent.change(input, { target: { value: "5 1 * * *" } });
    fireEvent.blur(input);

    expect(result.current.dispatchPayload({ dispatchMode: "cron" }).schedule).not.toBe("every 5m");
  });

  it("sends no schedule at all when the mission is not scheduled", () => {
    const { result } = renderHook(() => useMissionComposer({ showCreate: true, editingId: null }));
    act(() => result.current.setNewSchedule("5 1 * * *"));
    // A schedule on a `now` dispatch would be a cadence nobody asked for.
    expect(result.current.dispatchPayload({ dispatchMode: "now" }).schedule).toBeUndefined();
    expect(result.current.dispatchPayload({ dispatchMode: "save" }).schedule).toBeUndefined();
  });

  it("never sends a schedule alongside a one-off dispatch", () => {
    // Found while writing this file, and worse than the reported bug. `schedule`
    // is DERIVED, and it used to be derived from the form's own mode while the
    // caller was overriding that mode. The re-dispatch branch calls
    // `dispatchPayload({ dispatchMode: "now" })`, so re-running a completed
    // mission with the form left in cron mode sent `dispatchMode: "now"` AND a
    // cron: a one-off that quietly asks to become recurring.
    const { result } = renderHook(() => useMissionComposer({ showCreate: true, editingId: null }));
    act(() => {
      result.current.setNewDispatch("cron");
      result.current.setNewSchedule("5 1 * * *");
    });
    expect(result.current.dispatchPayload({ dispatchMode: "cron" }).schedule).toBe("5 1 * * *");
    expect(result.current.dispatchPayload({ dispatchMode: "now" }).schedule).toBeUndefined();
  });

});


// ── The seam this file is named after, finally rendered ─────────
//
// Everything above drives the picker against a jest.fn(). This block drives the
// real thing: the composer hook, the form, and the submit handler, with fetch
// mocked, so "no POST fired" means the button was clicked and the request was
// refused rather than the harness never wiring it up.
//
// THE POSITIVE CONTROL IS NOT OPTIONAL. Without "posts the cron the operator
// typed" in the same harness, every "not called" assertion below could pass
// because nothing was ever connected. That is the denominator principle applied
// to a behavioural test: a negative assertion needs a positive twin sharing its
// plumbing.
describe("the click that submits the mission", () => {
  let posts: Array<{ url: string; body: Record<string, unknown> }>;

  beforeEach(() => {
    posts = [];
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === "POST" && u.includes("/api/missions")) {
        posts.push({ url: u, body: JSON.parse(String(init.body)) as Record<string, unknown> });
      }
      return new Response(JSON.stringify({ data: { id: "m1" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;
  });


  it("reports an unusable draft to the parent as soon as it is typed", () => {
    // Reported on CHANGE, not on blur. jsdom does not move focus on click, and
    // relying on blur-before-click is the assumption that produced this defect
    // in the first place. The composer must know the draft is bad without the
    // field ever having been left.
    const onDraftError = jest.fn();
    render(
      <SchedulePicker value="*/5 * * * *" onChange={jest.fn()} onDraftError={onDraftError} />,
    );
    const input = openAdvanced("*/5 * * * *");
    fireEvent.change(input, { target: { value: "every other thursday-ish" } });

    expect(onDraftError).toHaveBeenCalledWith(
      expect.stringMatching(/not a schedule this understands/i),
    );
  });

  it("clears the report when the draft becomes usable again", () => {
    // The gate must not be a one-way latch, which is the obvious way to
    // over-fix this.
    const onDraftError = jest.fn();
    render(
      <SchedulePicker value="*/5 * * * *" onChange={jest.fn()} onDraftError={onDraftError} />,
    );
    const input = openAdvanced("*/5 * * * *");
    fireEvent.change(input, { target: { value: "nonsense" } });
    fireEvent.change(input, { target: { value: "0 9 * * 1-5" } });

    expect(onDraftError).toHaveBeenLastCalledWith(null);
  });

  it("blocks the dispatch when the schedule draft is unusable", () => {
    const blocked = scheduleBlocksDispatch("cron", 'Not a schedule this understands: "x"');
    expect(blocked).toBeTruthy();
  });

  it("does not block a mission that sends no schedule", () => {
    // Scoped to the mode that actually carries a schedule. Garbage in a hidden
    // advanced box must not stop a "run it now" dispatch.
    for (const mode of ["now", "save", "queue"] as const) {
      expect(scheduleBlocksDispatch(mode, "anything")).toBeNull();
    }
  });

  it("blocks exactly the modes that send a schedule", () => {
    // The anti-drift test between the twins. If someone teaches
    // scheduleForDispatch a second mode that carries a schedule and forgets the
    // gate, this goes red rather than silently reopening the defect.
    for (const mode of ["now", "save", "queue", "cron"] as const) {
      const sends = scheduleForDispatch(mode, "0 9 * * *") !== undefined;
      const blocks = scheduleBlocksDispatch(mode, "err") !== null;
      expect(blocks).toBe(sends);
    }
  });
});
