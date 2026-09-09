// useInterval — declarative setInterval for React.
//
// The callback lives in a ref so a changed identity does not restart the
// interval; `enabled: false` registers no timer. By default the timer is also
// suspended while the document is hidden and fires once on return: a console
// left on a background tab should not spend the night re-querying its own
// database, and TanStack Query gates `refetchInterval` on the same
// `visibilitychange`, so the hand-rolled timers match the query layer. The
// catch-up tick is what keeps the operator from reading a full period stale.

"use client";

import { useEffect, useRef, useState } from "react";

export interface UseIntervalOptions {
  /** Interval duration in milliseconds. */
  ms: number;
  /** When false, the interval is not registered (paused). Default true. */
  enabled?: boolean;
  /** Default true: suspend while hidden, one catch-up tick on return. */
  pauseWhenHidden?: boolean;
}

/**
 * Whether the document is visible; true unconditionally when `active` is
 * false, so an opted-out caller never subscribes. SSR-safe: initial `true`,
 * listener registered from an effect.
 */
function useDocumentVisible(active: boolean): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const read = () => setVisible(document.visibilityState !== "hidden");
    read();
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, [active]);

  return active ? visible : true;
}

/**
 * Run `fn` every `ms` while `enabled`.
 * @param fn   - Run on each tick; a returned Promise is ignored.
 * @param opts - `{ ms, enabled, pauseWhenHidden }`. `ms` must be > 0; hidden
 *               tabs suspend unless `pauseWhenHidden` is false, then catch up once.
 */
export function useInterval(
  fn: () => void | Promise<void>,
  { ms, enabled = true, pauseWhenHidden = true }: UseIntervalOptions,
): void {
  const fnRef = useRef(fn);
  // The latest callback in a ref, so callers need not memoize and re-renders do not restart the interval.
  useEffect(() => {
    fnRef.current = fn;
  });

  const visible = useDocumentVisible(pauseWhenHidden);
  // Set while suspended for a hidden tab, so "we just came back" is told from
  // mount; mount must NOT tick, since the caller loads its own initial data.
  const missedTicksRef = useRef(false);

  useEffect(() => {
    if (!enabled || ms <= 0) return;
    if (!visible) {
      missedTicksRef.current = true;
      return;
    }
    if (missedTicksRef.current) {
      missedTicksRef.current = false;
      void fnRef.current();
    }
    const id = setInterval(() => {
      void fnRef.current();
    }, ms);
    return () => clearInterval(id);
  }, [ms, enabled, visible]);
}
