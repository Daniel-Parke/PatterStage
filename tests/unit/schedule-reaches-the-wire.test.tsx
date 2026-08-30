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
 */

import { act, renderHook } from "@testing-library/react";
import { fireEvent, render, screen } from "@testing-library/react";

import SchedulePicker from "@/components/schedule/SchedulePicker";
import { useMissionComposer } from "@/hooks/useMissionComposer";

function openAdvanced(value: string) {
  fireEvent.click(screen.getByRole("button", { name: /Show advanced/i }));
  return screen.getByDisplayValue(value) as HTMLInputElement;
}

describe("a schedule typed into the picker reaches the dispatch payload", () => {
  it("carries a raw cron committed on blur", () => {
    const { result } = renderHook(() => useMissionComposer({ showCreate: true, editingId: null }));

    // The picker, driven exactly as an operator drives it.
    const onChange = jest.fn((s: string) => act(() => result.current.setNewSchedule(s)));
    render(<SchedulePicker value={result.current.newSchedule} onChange={onChange} />);
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
    render(<SchedulePicker value={result.current.newSchedule} onChange={onChange} />);
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
    render(<SchedulePicker value={result.current.newSchedule} onChange={onChange} />);
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

  it("an invalid draft leaves the previous schedule on the wire, and says so", () => {
    const { result } = renderHook(() => useMissionComposer({ showCreate: true, editingId: null }));
    const onChange = jest.fn((s: string) => act(() => result.current.setNewSchedule(s)));
    render(<SchedulePicker value={result.current.newSchedule} onChange={onChange} />);
    const input = openAdvanced("*/5 * * * *");
    fireEvent.change(input, { target: { value: "every other thursday-ish" } });
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/not a schedule this understands/i)).toBeInTheDocument();
  });
});
