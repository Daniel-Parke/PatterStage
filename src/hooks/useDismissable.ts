// ═══════════════════════════════════════════════════════════════
// useDismissable: the NON-modal dismissal contract, in one place.
//
// Ten components open a panel and close it by listening for a mousedown
// somewhere else. Written out ten times, the same fourteen lines drifted into
// six keyboard traps: five Selectors with no Escape handler at all, panels
// that drop focus on the floor when they unmount, and effects with an empty
// dependency array that hold a document listener open whether the panel is
// shut or not (T-0122).
//
// This is deliberately NOT useDialogA11y. A popover is not a modal:
//
//   · Tab is NOT trapped. Tabbing out of a menu should leave it, not cycle
//     inside it forever. Trapping a filter dropdown is how you strand someone.
//   · Body scroll is NOT locked. The page behind a popover is still the page.
//   · No role, no aria-modal. The caller owns its own semantics; a listbox and
//     a disclosure panel are not the same thing and this hook is neither.
//
// What the two DO share is the topmost-only rule, for the same reason: one
// Escape closes one thing.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * The open dismissables, innermost last.
 *
 * Module-level because it is genuinely global: any number of instances, one
 * keyboard. Shares its shape with useDialogA11y's stack but not its storage -
 * a popover inside a dialog must not take the dialog's Escape, and a dialog
 * opened from a popover must take it back.
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
 * @returns the ref to attach to the element enclosing BOTH the trigger and the
 * panel. Enclosing both is the whole trick: a pointer down on the trigger of an
 * open panel must not read as "outside", or a toggle would close and reopen on
 * one click and never appear to work.
 */
export function useDismissable<T extends HTMLElement = HTMLElement>({
  open,
  onClose,
}: DismissableOptions): RefObject<T | null> {
  const containerRef = useRef<T | null>(null);

  // onClose through a ref so the effect below depends on `open` ALONE.
  // Callers pass an inline arrow; with onClose in the dependency array every
  // parent re-render would tear the listeners down and set them up again,
  // which for this hook means re-reading which element had focus.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const idRef = useRef<symbol | null>(null);
  if (idRef.current === null) idRef.current = Symbol("dismissable");

  useEffect(() => {
    // Nothing is registered while the panel is shut. Ten hand-rolled versions
    // of this hold a document listener open for the life of the page.
    if (!open) return;

    const id = idRef.current as symbol;
    stack.push(id);

    const container = containerRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      // A pointer down inside the container - trigger or panel - is not a
      // dismissal. Anything else is, whichever panel it belongs to: clicking
      // straight from one open menu into another closes the first.
      if (container?.contains(target)) return;
      onCloseRef.current();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (stack[stack.length - 1] !== id) return;
      onCloseRef.current();
    };

    // Whether focus is inside, tracked as it moves rather than read at the
    // end. By the time this effect's cleanup runs React has already removed
    // the panel from the DOM, so `document.activeElement` is `body` and the
    // answer would always be "no" - a focus restoration that silently never
    // happens, which is the defect this hook exists to fix.
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

      // Restore focus ONLY if it was inside the panel that is going away. A
      // user who clicked elsewhere has already chosen where they are, and
      // yanking them back to the trigger of a menu they just dismissed is the
      // bug rather than the fix.
      if (focusInside && previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  return containerRef;
}
