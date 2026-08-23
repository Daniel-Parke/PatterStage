"use client";

import { useEffect } from "react";

/**
 * The bloom tier of the light system: one delegated pointer listener for the
 * whole site. The element under the cursor that carries `data-bloom` gets
 * `--bx`/`--by` (local position) and `--bloom: 1`; the CSS in globals.css
 * paints a soft radial there. Fine pointers only; reduced motion opts out;
 * renders nothing.
 */
export default function BloomField() {
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduce.matches) return;

    let current: HTMLElement | null = null;
    let pending: PointerEvent | null = null;
    let raf = 0;

    const clear = () => {
      if (!current) return;
      current.style.setProperty("--bloom", "0");
      current = null;
    };

    const apply = () => {
      raf = 0;
      const e = pending;
      pending = null;
      if (!e) return;
      const target = e.target as Element | null;
      const el = target?.closest?.("[data-bloom]") as HTMLElement | null;
      if (el !== current) {
        clear();
        current = el;
      }
      if (!current) return;
      const rect = current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const bx = ((e.clientX - rect.left) / rect.width) * 100;
      const by = ((e.clientY - rect.top) / rect.height) * 100;
      current.style.setProperty("--bx", `${bx.toFixed(2)}%`);
      current.style.setProperty("--by", `${by.toFixed(2)}%`);
      current.style.setProperty("--bloom", "1");
    };

    const onMove = (e: PointerEvent) => {
      pending = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => clear();

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
      clear();
    };
  }, []);

  return null;
}
