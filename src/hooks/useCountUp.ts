"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animate a number toward `target` with an easeOutCubic ramp. Animates from 0 on
 * first mount (a satisfying intro) and from the previous value on later changes,
 * so a 20s stats refetch only re-animates the figures that actually moved.
 * Respects prefers-reduced-motion.
 */
export function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    if (reduce || from === target || duration <= 0) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}
