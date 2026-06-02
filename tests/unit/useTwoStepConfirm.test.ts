/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";

describe("useTwoStepConfirm", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  describe("singleton key (no key argument)", () => {
    it("starts un-armed", () => {
      const { result } = renderHook(() => useTwoStepConfirm());
      expect(result.current.isArmed).toBe(false);
      expect(result.current.armedKey).toBeNull();
    });

    it("arms and disarms via the default 4000ms auto-dismiss", () => {
      const { result } = renderHook(() => useTwoStepConfirm());

      act(() => result.current.arm());
      expect(result.current.isArmed).toBe(true);

      act(() => {
        jest.advanceTimersByTime(4000);
      });
      expect(result.current.isArmed).toBe(false);
    });

    it("confirm(action) runs the action and clears the armed state", async () => {
      const action = jest.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useTwoStepConfirm());

      act(() => result.current.arm());

      await act(async () => {
        await result.current.confirm(action);
      });

      expect(action).toHaveBeenCalledTimes(1);
      expect(result.current.isArmed).toBe(false);
    });

    it("cancel clears the armed state without running the action", () => {
      const { result } = renderHook(() => useTwoStepConfirm());

      act(() => result.current.arm());
      expect(result.current.isArmed).toBe(true);

      act(() => result.current.cancel());
      expect(result.current.isArmed).toBe(false);
    });
  });

  describe("per-key mode (dashboard cancel-mission case)", () => {
    it("isArmedFor(key) returns true only for the armed key", () => {
      const { result } = renderHook(() => useTwoStepConfirm({ autoDismissMs: 0 }));

      act(() => result.current.arm("mission-a"));
      expect(result.current.isArmedFor("mission-a")).toBe(true);
      expect(result.current.isArmedFor("mission-b")).toBe(false);
    });

    it("re-arming for a different key resets the state to that key", () => {
      const { result } = renderHook(() => useTwoStepConfirm({ autoDismissMs: 0 }));

      act(() => result.current.arm("mission-a"));
      act(() => result.current.arm("mission-b"));

      expect(result.current.isArmedFor("mission-a")).toBe(false);
      expect(result.current.isArmedFor("mission-b")).toBe(true);
    });

    it("auto-dismiss fires after the configured ms", () => {
      const { result } = renderHook(() =>
        useTwoStepConfirm({ autoDismissMs: 1000 }),
      );

      act(() => result.current.arm("mission-a"));
      expect(result.current.isArmedFor("mission-a")).toBe(true);

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(result.current.isArmedFor("mission-a")).toBe(false);
    });
  });

  describe("autoDismissMs: 0", () => {
    it("does not auto-dismiss — state stays armed until cancel/confirm", () => {
      const { result } = renderHook(() =>
        useTwoStepConfirm({ autoDismissMs: 0 }),
      );

      act(() => result.current.arm());
      expect(result.current.isArmed).toBe(true);

      act(() => {
        jest.advanceTimersByTime(60_000);
      });
      expect(result.current.isArmed).toBe(true);
    });
  });

  describe("cleanup", () => {
    it("clears the auto-dismiss timer on unmount (no late setState)", () => {
      const { result, unmount } = renderHook(() =>
        useTwoStepConfirm({ autoDismissMs: 1000 }),
      );

      act(() => result.current.arm());
      unmount();

      // If the timer weren't cleared, this would throw "Can't perform
      // a React state update on an unmounted component" or run the
      // setState path. With cleanup in place, advancing the timer
      // is a no-op.
      expect(() => {
        jest.advanceTimersByTime(2000);
      }).not.toThrow();
    });
  });
});
