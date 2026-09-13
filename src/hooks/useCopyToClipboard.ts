// ═══════════════════════════════════════════════════════════════
// useCopyToClipboard — "copy to clipboard + show 'copied' flag
// for N ms" hook
// ═══════════════════════════════════════════════════════════════
//
// Deliberately sync: `writeText` is fire-and-forget. MissionPromptPreview
// awaits it inside a try/catch, which is a different shape and is left alone.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
): [boolean, (text: string) => void] {
  const { resetMs = 2000 } = options;
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup the in-flight timer on unmount. Without this, navigating
  // away during the `resetMs` window would call `setCopied(false)` on
  // an unmounted component.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const copy = useCallback(
    (text: string) => {
      // Cancel any in-flight timer so back-to-back copy clicks
      // don't double-fire the flip-back.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void navigator.clipboard.writeText(text);
      setCopied(true);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setCopied(false);
      }, resetMs);
    },
    [resetMs],
  );

  return [copied, copy];
}
