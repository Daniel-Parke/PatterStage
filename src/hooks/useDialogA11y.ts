// useDialogA11y: the modal-dialog behaviour contract, in ONE place.
//
// Sheet owned half of this inline and Modal none, so Modal announced itself as
// a plain <div> and a QA pass reported three working controls as dead buttons
// (T-0036). Both components call this hook. It owns Escape, the Tab ring and
// focus recapture, focus on open and restore on close, and the body scroll
// lock. It does NOT own the role and aria attributes, which differ per
// component: the caller spreads them onto its own panel.

import { useEffect, useRef, type RefObject } from "react";

/**
 * The open dialogs, innermost last. Escape and the Tab trap belong to the
 * TOPMOST only: the category modal opens OVER the composer sheet, so one Escape
 * closed both and lost a half-filled mission. Module-level because it is
 * global: two components, any number of instances, one keyboard.
 */
const dialogStack: symbol[] = [];

function isTopmost(id: symbol): boolean {
  return dialogStack.length > 0 && dialogStack[dialogStack.length - 1] === id;
}

/**
 * Everything tabbable, minus anything out of the tab order or not drawn.
 * The trap acts at the ring's two ENDS only, so a hidden control at an end
 * is a leak: the rail's `hidden lg:flex` collapse button was last in the
 * drawer on a phone, and Tab walked out to the hamburger behind the backdrop.
 *
 * `getClientRects().length` is zero for `display: none` and for EVERYTHING
 * under jsdom, which does no layout, so the filter is guarded: when nothing
 * has a rect the ring is the unfiltered list, the dialog suites keep asserting
 * the trap, and u14-the-trap-skips-what-is-not-drawn stubs layout (T-0128).
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusableWithin(panel: HTMLElement): HTMLElement[] {
  const tabbable = Array.from(
    panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (el) =>
      el.getAttribute("aria-hidden") !== "true" && !el.hasAttribute("inert"),
  );
  const drawn = tabbable.filter((el) => el.getClientRects().length > 0);
  return drawn.length > 0 ? drawn : tabbable;
}

interface DialogA11yOptions {
  /** Whether the dialog is currently rendered. */
  open: boolean;
  /** Called when Escape is pressed. */
  onClose: () => void;
}

/**
 * Wire the contract to a panel element.
 * @returns the ref for the panel carrying `role="dialog"`; give it
 * `tabIndex={-1}` so focus can land when the dialog holds no control.
 */
export function useDialogA11y({
  open,
  onClose,
}: DialogA11yOptions): RefObject<HTMLDivElement | null> {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // onClose is read through a ref so the effect depends on `open` ALONE:
  // callers pass inline arrows, and re-running the effect moves focus back
  // onto the panel, which makes a trapped dialog impossible to type into.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // A ref so the identity survives re-renders; a new symbol each render corrupts the stack.
  const idRef = useRef<symbol | null>(null);
  if (idRef.current === null) idRef.current = Symbol("dialog");

  useEffect(() => {
    if (!open) return;
    const id = idRef.current as symbol;
    dialogStack.push(id);

    const panel = panelRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const onKey = (e: KeyboardEvent) => {
      // Only the dialog on top reacts. One underneath keeps its listener so it
      // takes over the moment the one above closes.
      if (!isTopmost(id)) return;
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      const items = focusableWithin(panel);
      if (items.length === 0) {
        // Nothing to move to: keep focus on the panel rather than let Tab out.
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      // The panel itself counts as OUTSIDE the ring: from it Tab goes to
      // `first` and Shift+Tab to `last`, which is what "outside" produces.
      const inRing = active !== null && active !== panel && panel.contains(active);

      if (e.shiftKey) {
        if (!inRing || active === first) {
          e.preventDefault();
          last.focus();
        }
        return;
      }
      if (!inRing || active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // The panel, not its first control: it carries the accessible name, so a
    // screen reader announces the title rather than an unexplained "Close".
    panel?.focus();

    return () => {
      const at = dialogStack.lastIndexOf(id);
      if (at !== -1) dialogStack.splice(at, 1);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      // Restore focus to the trigger unless it left the document (a row the dialog deleted).
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  return panelRef;
}
