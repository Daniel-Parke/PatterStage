// useDismissable: the NON-modal dismissal contract, in one place. Ten
// components closed a panel on an outside mousedown, and the same fourteen
// lines drifted into six keyboard traps: Selectors with no Escape, focus
// dropped on unmount, and document listeners held open while shut (T-0122).
//
// Deliberately NOT useDialogA11y. A popover is not a modal: Tab is not trapped
// (tabbing out of a menu should leave it), body scroll is not locked, and no
// role or aria-modal is set (the caller owns its semantics). What the two share
// is the topmost-only rule: one Escape closes one thing.

"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * The open dismissables, innermost last. Module-level because one keyboard
 * serves every instance. Same shape as useDialogA11y's stack, separate storage:
 * a popover inside a dialog must not take the dialog's Escape, and vice versa.
 */
const stack: symbol[] = [];

interface DismissableOptions {
  /** Whether the panel is currently rendered. */
  open: boolean;
  /** Called on Escape, or on a pointer down outside the container. */
  onClose: () => void;
}

/**
 * Wire the dismissal contract to a container element.
 *
 * @returns the ref for the element enclosing BOTH trigger and panel: a pointer
 * down on the trigger of an open panel must not read as "outside", or a toggle
 * would close and reopen on one click.
 */
export function useDismissable<T extends HTMLElement = HTMLElement>({
  open,
  onClose,
}: DismissableOptions): RefObject<T | null> {
  const containerRef = useRef<T | null>(null);

  // onClose through a ref so the effect depends on `open` ALONE: callers pass an
  // inline arrow, and every parent re-render would re-read which element had focus.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const idRef = useRef<symbol | null>(null);
  if (idRef.current === null) idRef.current = Symbol("dismissable");

  useEffect(() => {
    // Nothing is registered while shut; the hand-rolled versions held a listener for the page's life.
    if (!open) return;

    const id = idRef.current as symbol;
    stack.push(id);

    const container = containerRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      // Inside the container (trigger or panel) is not a dismissal. Anything
      // else is, whichever panel it belongs to.
      if (container?.contains(target)) return;
      onCloseRef.current();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (stack[stack.length - 1] !== id) return;
      onCloseRef.current();
    };

    // Focus tracked as it moves, not read at cleanup: by then React has removed
    // the panel, `document.activeElement` is `body`, and restoration would
    // silently never happen, which is the defect this hook exists to fix.
    let focusInside =
      document.activeElement instanceof HTMLElement &&
      container !== null &&
      container.contains(document.activeElement);
    const onFocusIn = (e: FocusEvent) => {
      focusInside = e.target instanceof Node && (container?.contains(e.target) ?? false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      const at = stack.lastIndexOf(id);
      if (at !== -1) stack.splice(at, 1);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocusIn);

      // Restore focus ONLY if it was inside the departing panel: a user who
      // clicked elsewhere has already chosen where they are.
      if (focusInside && previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  return containerRef;
}
