// ═══════════════════════════════════════════════════════════════
// useTwoStepConfirm — Two-click confirmation hook
// ═══════════════════════════════════════════════════════════════
//
// The PatterStage dashboard has a few destructive actions that should
// require a second click to confirm (cancel a mission, delete all logs,
// etc.). The pattern was duplicated verbatim across at least two pages:
//
//   1. Arm state on first click; show the "armed" UI variant.
//   2. On the second click, run the destructive action; clear armed state.
//   3. Auto-dismiss the armed state after a timeout so the user doesn't
//      accidentally click the "Cancel" button hours later and trigger
//      a real cancel.
//   4. Clean up the timeout on unmount so a stale setState doesn't fire.
//
// Both the dashboard (`handleCancelMission`) and the logs page
// (`handleDeleteAllLogs`) had a near-identical 15-line implementation
// of this pattern. The dashboard version used a per-id string
// ("which mission is armed?") while the logs version used a single
// boolean. This hook supports both via a `key: string | null` param.
//
// Usage:
//   const { armed, arm, confirm, cancel } = useTwoStepConfirm({
//     autoDismissMs: 4000,
//   });
//
//   <button onClick={() => {
//     if (!armed(missionId)) arm(missionId);
//     else confirm(() => doCancel(missionId));
//   }}>{armed(missionId) ? "Confirm?" : "Cancel"}</button>
//
//   // The single-key variant (e.g. logs page):
//   const { isArmed, armAndConfirm, cancel } = useTwoStepConfirm({ ... });
//   <button onClick={() => {
//     if (!isArmed) armAndConfirm();
//     else cancel();
//   }}>{isArmed ? "Confirm Clear" : "Delete All"}</button>

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseTwoStepConfirmOptions {
  /**
   * Auto-dismiss the armed state after this many milliseconds.
   * Default 4000. Pass `0` to disable auto-dismiss (the state stays
   * armed until the user clicks confirm or cancel).
   */
  autoDismissMs?: number;
}

export interface UseTwoStepConfirmResult {
  /** Currently-armed key (e.g. mission id), or null when nothing is armed. */
  armedKey: string | null;
  /** Convenience boolean: `armedKey !== null`. */
  isArmed: boolean;
  /** True iff `key` matches the currently-armed key. */
  isArmedFor: (key: string) => boolean;
  /** Arm the state for `key` (or re-arm for a different key). Resets the auto-dismiss timer. */
  arm: (key?: string) => void;
  /** Run the `action` and clear the armed state. Use this on the "second click" path. */
  confirm: (action: () => void | Promise<void>) => Promise<void>;
  /** Clear the armed state without running any action. Use for explicit cancel buttons. */
  cancel: () => void;
}

/**
 * Two-step confirmation state with optional auto-dismiss.
 *
 * @param options.autoDismissMs — ms before the armed state auto-clears.
 *                                `0` disables auto-dismiss. Default 4000.
 */
export function useTwoStepConfirm(
  options: UseTwoStepConfirmOptions = {},
): UseTwoStepConfirmResult {
  const { autoDismissMs = 4000 } = options;
  const [armedKey, setArmedKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup the timer on unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const arm = useCallback(
    (key: string = "__singleton__") => {
      clearTimer();
      setArmedKey(key);
      if (autoDismissMs > 0) {
        timerRef.current = setTimeout(() => {
          setArmedKey(null);
          timerRef.current = null;
        }, autoDismissMs);
      }
    },
    [autoDismissMs, clearTimer],
  );

  const confirm = useCallback(
    async (action: () => void | Promise<void>) => {
      clearTimer();
      setArmedKey(null);
      await action();
    },
    [clearTimer],
  );

  const cancel = useCallback(() => {
    clearTimer();
    setArmedKey(null);
  }, [clearTimer]);

  return {
    armedKey,
    isArmed: armedKey !== null,
    isArmedFor: (key: string) => armedKey === key,
    arm,
    confirm,
    cancel,
  };
}
