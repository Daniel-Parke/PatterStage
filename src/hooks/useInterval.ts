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
// ── Hidden tabs ──────────────────────────────────────────────────
// By default the timer is also suspended while the document is hidden,
// and fires once the moment the tab comes back. A console left open on
// a background tab overnight should not spend the night re-querying its
// own database, and a clock nobody can see does not need to re-render
// every second. TanStack Query already behaves this way: its
// `refetchInterval` is gated on the same `visibilitychange` signal,
// so this makes the hand-rolled timers match the query layer instead of
// quietly disagreeing with it.
//
// The catch-up tick on return matters: without it the operator would
// look at data that is up to one full period stale and have no way to
// know. With it, the tab is fresh by the time they have read it. Pass
// `pauseWhenHidden: false` for a timer that must keep running unseen.
//
// Scope note: this hook fits the simple single-interval case
// (logs auto-refresh, sessions live-tick, etc.). The dashboard's
// 3-way polling block needs to share one AbortController across
// all three fetches, so it intentionally uses raw setInterval +
// forEach cleanup. If a future call site needs a shared signal,
// extract a `usePollWithAbort` variant.

"use client";

import { useEffect, useRef, useState } from "react";

export interface UseIntervalOptions {
  /** Interval duration in milliseconds. */
  ms: number;
  /** When false, the interval is not registered (paused). Default true. */
  enabled?: boolean;
  /**
   * When true (the default) the interval is suspended while the document is
   * hidden, and fires one catch-up tick when it becomes visible again.
   */
  pauseWhenHidden?: boolean;
}

/**
 * Whether the document is currently visible. Returns true unconditionally when
 * `active` is false, so a caller that opted out of the visibility gate never
 * subscribes to the event at all.
 *
 * SSR-safe: the initial value is `true` and the listener is registered from an
 * effect, so the server render and the first client render agree.
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
 * Run `fn` every `ms` milliseconds while `enabled` is true.
 *
 * @param fn   - The callback to run on each tick. May return a Promise;
 *               the return value is ignored (use a fire-and-forget API).
 * @param opts - `{ ms, enabled, pauseWhenHidden }`. When `enabled` is false the
 *               interval is not started at all. `ms` must be > 0. While the tab
 *               is hidden the interval is suspended unless `pauseWhenHidden` is
 *               explicitly false; on return it fires once immediately and then
 *               resumes its cadence.
 */
export function useInterval(
  fn: () => void | Promise<void>,
  { ms, enabled = true, pauseWhenHidden = true }: UseIntervalOptions,
): void {
  const fnRef = useRef(fn);
  // Keep the latest callback in the ref so callers don't need to memoize.
  // Without this, every parent re-render would restart the interval
  // (because the effect's dep would change).
  useEffect(() => {
    fnRef.current = fn;
  });

  const visible = useDocumentVisible(pauseWhenHidden);
  // Set while the timer is suspended for a hidden tab, so the effect can tell
  // "we just came back, catch up" from "we are mounting for the first time".
  // Mount must NOT fire a tick, because the caller loads its own initial data.
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
