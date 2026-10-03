// ═══════════════════════════════════════════════════════════════
// useCopyToClipboard — "copy to clipboard + show 'copied' flag
// for N ms" hook
// ═══════════════════════════════════════════════════════════════
//
// Success follows the clipboard promise; obsolete replies cannot update a new owner.

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/Toast";

export interface UseCopyToClipboardOptions {
  /**
   * How long the `copied` flag stays `true` after a successful
   * `copy()` call, in milliseconds. Default 2000 (2s).
   */
  resetMs?: number;
}

/**
 * Manage a transient "copied" boolean flag in sync with the
 * `navigator.clipboard.writeText` lifecycle. Returns the flag
 * and an action that writes the given text and flips the flag
 * to `true` for `resetMs` (default 2000ms).
 *
 * The flag flips back to `false` on its own after `resetMs`. Calling
 * `copy(text)` again while the flag is still `true` cancels the in-flight
 * timer and re-arms a fresh `resetMs` window.
 *
 * SSR-safe: `navigator` is only read inside `copy()`, which is event-driven.
 */
export function useCopyToClipboard(
  options: UseCopyToClipboardOptions = {},
): [boolean, (text: string) => void, ReactNode] {
  const { resetMs = 2000 } = options;
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const owner = useRef(0);
  const mounted = useRef(true);
  const { showToast, toastElement } = useToast();

  // Cleanup the in-flight timer on unmount. Without this, navigating
  // away during the `resetMs` window would call `setCopied(false)` on
  // an unmounted component.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      owner.current += 1;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const copy = useCallback(
    async (text: string) => {
      const request = ++owner.current;
      // Cancel any in-flight timer so back-to-back copy clicks
      // don't double-fire the flip-back.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setCopied(false);
      try {
        await navigator.clipboard.writeText(text);
        if (!mounted.current || owner.current !== request) return;
        setCopied(true);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setCopied(false);
        }, resetMs);
      } catch {
        if (mounted.current && owner.current === request) {
          showToast("Could not copy to clipboard", "error");
        }
      }
    },
    [resetMs, showToast],
  );

  return [copied, copy, toastElement];
}
