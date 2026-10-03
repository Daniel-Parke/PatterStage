// ═══════════════════════════════════════════════════════════════
// useTwoStepConfirm — Two-click confirmation hook
// ═══════════════════════════════════════════════════════════════
//
// Destructive actions (cancel a mission, delete all logs) take a second
// click to confirm. The armed state auto-dismisses after a timeout so the
// user doesn't click a "Cancel" button hours later and trigger a real
// cancel, and the timer is cleared on unmount so a stale setState doesn't
// fire. The key is per-id ("which mission is armed?") or a singleton.

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
