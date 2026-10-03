"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animate a number toward `target` with an easeOutCubic ramp. Seeds from
 * `target`, so the FIRST painted frame is the real figure, and ramps only when
 * the value later changes: a 20s stats refetch re-animates the figures that
 * actually moved and leaves the rest still.
 *
 * It used to seed `useState(0)` / `useRef(0)` for "a satisfying intro", which
 * meant the first frame of every stat tile in the app was literally 0. QA read
 * that as zeroed stat rows on four surfaces, and it was not wrong to: a tile
 * counting a hard-coded 7-element array still painted 0, and a strip painted
 * active:0 beside inactive:0 where the two must sum to 218. A tile is a
 * statement of fact before it is an animation, so the intro lost (T-0035).
 *
 * Respects prefers-reduced-motion.
 */
export function useCountUp(target: number, duration = 800): number {
  // Seeded from the target, not from zero. On mount `from === target`, so the
  // effect below takes its no-op branch and nothing animates on a first paint.
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  // The frame most recently handed to the DOM. Cleanup reads it, because a
  // cleanup closure cannot see current state.
  const paintedRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    if (reduce || from === target || duration <= 0) {
      fromRef.current = target;
      paintedRef.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      paintedRef.current = next;
      setValue(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      // Commit the frame that was on screen. Committing only on completion, as
      // this hook once did, left `fromRef` at the origin of an abandoned ramp,
      // so the next change restarted from a stale number and snapped backwards.
      fromRef.current = paintedRef.current;
    };
  }, [target, duration]);

  return value;
}
