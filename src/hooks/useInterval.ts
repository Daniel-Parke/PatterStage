// ═══════════════════════════════════════════════════════════════
// useInterval — Declarative setInterval wrapper for React
// ═══════════════════════════════════════════════════════════════
//
// Multiple PatterStage pages run a `setInterval` for polling or
// live-tick re-renders. The pattern is identical in every one:
//
//   useEffect(() => {
//     if (!enabled) return;
//     const id = setInterval(() => fn(), ms);
//     return () => clearInterval(id);
//   }, [enabled, ms]);
//
// This hook centralises the pattern so the call sites are one-liners:
//
//   useInterval(refetch, { ms: 10000 });
//   useInterval(() => setNowTick(n => n + 1), { ms: 1000 });
//   useInterval(refetch, { ms: 5000, enabled: autoRefresh });
//
// The callback is stored in a ref so changing its identity doesn't
// restart the interval (otherwise the dashboard's polls would re-arm
// on every render of the parent).
//
// On unmount the timer is cleared (the effect's cleanup runs). The
// `enabled: false` path also doesn't register the interval, so a
// "polling paused" toggle costs zero timers in the browser.
//
// Scope note: this hook fits the simple single-interval case
// (logs auto-refresh, sessions live-tick, etc.). The dashboard's
// 3-way polling block needs to share one AbortController across
// all three fetches, so it intentionally uses raw setInterval +
// forEach cleanup. If a future call site needs a shared signal,
// extract a `usePollWithAbort` variant.

"use client";

import { useEffect, useRef } from "react";

export interface UseIntervalOptions {
  /** Interval duration in milliseconds. */
  ms: number;
  /** When false, the interval is not registered (paused). Default true. */
  enabled?: boolean;
}

/**
 * Run `fn` every `ms` milliseconds while `enabled` is true.
 *
 * @param fn   - The callback to run on each tick. May return a Promise;
 *               the return value is ignored (use a fire-and-forget API).
 * @param opts - `{ ms, enabled }`. When `enabled` is false the interval
 *               is not started at all. `ms` must be > 0.
 */
export function useInterval(
  fn: () => void | Promise<void>,
  { ms, enabled = true }: UseIntervalOptions,
): void {
  const fnRef = useRef(fn);
  // Keep the latest callback in the ref so callers don't need to memoize.
  // Without this, every parent re-render would restart the interval
  // (because the effect's dep would change).
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (!enabled || ms <= 0) return;
    const id = setInterval(() => {
      void fnRef.current();
    }, ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
}
