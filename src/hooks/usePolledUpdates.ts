// ═══════════════════════════════════════════════════════════════
// usePolledUpdates — Multi-endpoint polling with shared abort
// ═══════════════════════════════════════════════════════════════
//
// The dashboard polls three endpoints on independent intervals
// (`/api/monitor` every 10s, `/api/agents` every 15s, `/api/missions`
// every 15s) and merges the results into a single `setData` state
// slice. Each tick the parent needs to:
//   1. fetch the endpoint
//   2. walk the envelope to the inner payload
//   3. map the inner payload to a `Partial<DashboardData>` update
//   4. forward the update to the parent's `setData` callback
//
// `useApiData` (src/hooks/useApiData.ts) covers the *single-endpoint*
// case (logs page, sessions page, session detail page, etc.). It
// manages its own state slice and exposes a `refetch` callback.
// The dashboard's case is different — three endpoints, three
// independent intervals, one shared `setData` state merge.
//
// This hook lifts the dashboard's `useEffect` polling block (a 25-line
// `setInterval` orchestration that manually aborts on unmount) into a
// reusable `usePolledUpdates(apply, polls)` call. The hook:
//   - creates one `AbortController` on mount
//   - registers one `setInterval` per `PollSpec`
//   - on each tick, fetches the URL, walks the envelope, calls
//     `extract`, and pushes the update to `apply` (if non-null)
//   - on unmount, aborts the controller and clears every interval
//
// **Robustness note**: the `polls` array and the `apply` callback are
// stored in refs (updated on every render via `useEffect`) so the
// interval registration is effect-once-per-mount. Re-rendering the
// parent with a new `polls` array reference does NOT re-arm the
// intervals — the latest `polls` and `apply` are picked up on the
// next tick. This matches `useInterval`'s "callback stored in a ref
// so changing its identity doesn't restart the interval" pattern
// (src/hooks/useInterval.ts:20-22) and prevents the
// "inline-polls-array-allocates-a-new-ref-every-render" trap that
// would otherwise re-arm all three intervals on every parent
// re-render.
//
// Byte-equivalent to the inline form: same `setInterval` cadence,
// same `AbortController` lifecycle, same per-tick fetch + envelope
// walk + update flow. The hook doesn't introduce any new
// React-state or fetch throttling — every state write goes through
// the caller's `apply` callback, which preserves the
// "single render per set of polls" guarantee the inline form had.
//
// **Why this lives in `src/hooks/` (not `src/lib/`)**: the hook
// imports `useEffect` from React, so it must live in a client module.
// The companion `PollSpec<T>` type and `definePolls` factory live
// in `src/lib/dashboard-poll.ts` so the data shape is reusable from
// server-side test fixtures and from any future server-rendered
// poll-prefetching.

"use client";

import { useEffect, useRef } from "react";
import { safeApiCall } from "@/lib/api-fetch";
import { unwrapPollPath, type PollSpec } from "@/lib/dashboard-poll";

/**
 * Register a set of `setInterval` polls. On every tick, each poll
 * fetches its URL, walks the envelope via `unwrapPollPath`, and
 * forwards the `extract` mapper's result to `apply` (if non-null).
 *
 * All polls share a single `AbortController` — aborting it cancels
 * every in-flight fetch and the unmount cleanup clears every
 * interval.
 *
 * @param apply - The callback that merges an update into the parent's
 *                state. Called with the value returned from a poll's
 *                `extract` mapper; never called with `null`. The
 *                caller is responsible for the state-merge semantics
 *                (e.g. `setData((prev) => ({ ...prev, ...update }))`).
 * @param polls - Read-only array of `PollSpec<TUpdate>` entries.
 *                The latest reference is read on every tick via a
 *                ref, so inline arrays (and the resulting new-ref-
 *                per-render) don't re-arm the intervals. Wrap the
 *                array in `useMemo` (or use `definePolls` at module
 *                scope) for explicit re-arm-on-change semantics.
 */
export function usePolledUpdates<TUpdate>(
  apply: (update: TUpdate) => void,
  polls: ReadonlyArray<PollSpec<TUpdate>>,
): void {
  // Keep the latest `polls` and `apply` in refs so the intervals
  // see the freshest values on every tick without re-arming.
  const pollsRef = useRef(polls);
  const applyRef = useRef(apply);
  useEffect(() => {
    pollsRef.current = polls;
    applyRef.current = apply;
  });

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const intervals = pollsRef.current.map((poll) => {
      const { url, ms, paths, extract } = poll;
      return setInterval(() => {
        if (signal.aborted) return;
        void (async () => {
          const { data: raw } = await safeApiCall(url, { signal });
          if (!raw) return;
          const inner = unwrapPollPath(raw, paths);
          if (!inner) return;
          const update = extract(inner);
          if (update !== null && update !== undefined) {
            applyRef.current(update);
          }
        })();
      }, ms);
    });

    return () => {
      controller.abort();
      intervals.forEach(clearInterval);
    };
  }, []);
}
