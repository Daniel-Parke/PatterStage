// ═══════════════════════════════════════════════════════════════
// useCopyToClipboard — "copy to clipboard + show 'copied' flag
// for N ms" hook
// ═══════════════════════════════════════════════════════════════
//
// The "click a Copy button, write to navigator.clipboard, flip a
// 'copied' state true, then back to false after a short timeout"
// pattern was inlined in 2+ PatterStage components:
//
//   - src/components/session/MessageBubble.tsx (handleCopy, 1500ms)
//   - src/app/operations/personalities/page.tsx (PersonalityCard
//     handleCopy, 2000ms)
//
// Both sites used the SAME 3-ingredient pattern:
//
//   1. A `[copied, setCopied] = useState(false)` boolean flag.
//   2. A `useRef<ReturnType<typeof setTimeout> | null>(null)` ref
//      to keep a handle on the in-flight timer so it can be
//      cancelled (on back-to-back copy clicks) and on unmount.
//   3. A `useEffect` cleanup that clears the timer on unmount —
//      without it, navigating away during the 2s window would
//      fire `setCopied(false)` on an unmounted component (React
//      warns in dev, but the real cost is wasted work in prod).
//
// Centralising the pattern as a hook returns a stable tuple
// `[copied, copy]` where `copy(text)` is the action and `copied`
// is the boolean the JSX reads to swap the icon. The hook owns
// the timer, the ref, the cleanup, AND the empty-string fallback
// (`writeText` accepts an empty string, so callers don't need to
// defensively pass `""`).
//
// Sister sites (anti-migration guards):
//   - src/components/missions/MissionPromptPreview.tsx uses a
//     DIFFERENT shape: the timer is owned by a `useEffect` keyed
//     on `copied` (so a state flip → set timeout, the timeout
//     cleanup runs on the next state flip), and the `writeText`
//     call is `await`ed inside a `try/catch` (the surrounding
//     function is async). Migrating that site would change the
//     throw-vs-resolve semantics (the hook swallows errors, the
//     inline form's `try { ... } catch { ignore }` is
//     byte-equivalent in behaviour but visible in the source). The
//     hook is intentionally sync; the async sister is a different
//     shape and is left as an anti-migration guard.
//   - src/components/missions/MissionEditorPanel.tsx calls
//     `navigator.clipboard.writeText` ONCE inside an async editor
//     action (no "copied" flag, no timeout, no flip-back) — single
//     use, different shape, not a duplication target.
//   - src/app/orchestration/chat/page.tsx uses
//     `navigator.clipboard.writeText(code).then(...)` as the
//     fire-and-forget form of the same operation (no "copied"
//     flag, no setTimeout, no ref) — single use, not a duplication
//     target.

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
 * The hook is sync — the underlying `writeText` Promise is
 * fire-and-forget. The pre-existing inline forms in
 * `MessageBubble` and `PersonalityCard` are both sync; the async
 * sister in `MissionPromptPreview` is intentionally NOT migrated
 * (different throw-vs-resolve shape).
 *
 * The flag flips back to `false` on its own after `resetMs` (no
 * caller cleanup needed). Calling `copy(text)` again while the
 * flag is still `true` cancels the in-flight timer and re-arms a
 * fresh `resetMs` window — matching the inline pre-refactor
 * behaviour where back-to-back copy clicks clear the previous
 * timer before setting a new one.
 *
 * The hook is SSR-safe: `navigator` is only read inside `copy()`,
 * which is event-driven (only runs in the browser).
 *
 * @example
 *   const [copied, copy] = useCopyToClipboard({ resetMs: 1500 });
 *   <button onClick={() => copy(message.content)}>
 *     {copied ? <Check /> : <Copy />}
 *   </button>
 */
export function useCopyToClipboard(
  options: UseCopyToClipboardOptions = {},
): [boolean, (text: string) => void] {
  const { resetMs = 2000 } = options;
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup the in-flight timer on unmount. Without this, navigating
  // away during the `resetMs` window would call `setCopied(false)` on
  // an unmounted component. Mirrors the pre-refactor cleanup in both
  // `MessageBubble` and `PersonalityCard`.
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
      // don't double-fire the flip-back. Same as the pre-refactor
      // `if (timerRef.current) clearTimeout(timerRef.current)`
      // line at the top of both inline `handleCopy` forms.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Fire-and-forget — same shape as the pre-refactor inline
      // form. The async sister in MissionPromptPreview intentionally
      // `await`s this with a try/catch; that's a different shape
      // (see JSDoc above).
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
