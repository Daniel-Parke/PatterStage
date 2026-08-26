// ═══════════════════════════════════════════════════════════════
// useDialogA11y: the modal-dialog behaviour contract, in ONE place.
//
// Sheet.tsx owned half of this inline (Escape + body scroll lock) and
// Modal.tsx owned none of it, which is how three working controls came to
// report as dead buttons: a text-scraping QA pass and a screen reader both
// look for [role=dialog], and Modal announced itself as a plain <div>
// (T-0036). Rather than write the missing half a second time in Modal, the
// shared half moved here and BOTH components call this hook. Sheet's public
// API is untouched; it gains the focus trap it was always missing.
//
// What the hook owns:
//   · Escape closes.
//   · Tab and Shift+Tab wrap inside the panel, and focus that has escaped
//     the panel is pulled back into it.
//   · Focus moves onto the panel when it opens and is restored to whatever
//     had focus before (the trigger) when it closes.
//   · Body scroll is locked while open and restored to its previous value.
//
// What the hook does NOT own, because it differs per component: the role and
// aria attributes themselves. The caller spreads them onto its own panel
// element, so Modal can point aria-labelledby at its existing <h2> while
// Sheet keeps the aria-label its callers already rely on.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, type RefObject } from "react";

/**
 * The open dialogs, innermost last.
 *
 * Escape and the Tab trap must belong to the TOPMOST dialog only. Without
 * this, every open dialog registers its own document-level keydown listener
 * and they all fire together: on the missions page the category modal opens
 * OVER the composer sheet (the opener does not close the sheet), so one
 * Escape closed both and the operator lost a half-filled mission to a
 * keystroke aimed at the modal on top of it. The Tab trap only avoided the
 * same fight by accident of mount order.
 *
 * Module-level because it is genuinely global: two components, any number of
 * instances, one keyboard.
 */
const dialogStack: symbol[] = [];

function isTopmost(id: symbol): boolean {
  return dialogStack.length > 0 && dialogStack[dialogStack.length - 1] === id;
}

/**
 * Everything tabbable, MINUS anything explicitly removed from the tab order.
 *
 * Deliberately NOT filtered by visibility. The obvious extra guard here is
 * `offsetParent !== null` or `getClientRects().length > 0`, and under jsdom
 * both are false for every element in the tree, because jsdom does no layout.
 * A visibility filter would therefore make the trap silently degrade to "no
 * focusable elements" in every test that asserts it, a guard that cannot be
 * seen to work. Real hidden controls are rare inside a dialog, and `disabled`
 * plus `[tabindex="-1"]` plus `aria-hidden` cover the cases that actually
 * occur in this codebase.
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
  return Array.from(
    panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (el) =>
      el.getAttribute("aria-hidden") !== "true" && !el.hasAttribute("inert"),
  );
}

interface DialogA11yOptions {
  /** Whether the dialog is currently rendered. */
  open: boolean;
  /** Called when Escape is pressed. */
  onClose: () => void;
}

/**
 * Wire the dialog behaviour contract to a panel element.
 *
 * @returns the ref to attach to the panel that carries `role="dialog"`. The
 * panel needs `tabIndex={-1}` so focus has somewhere to land when the dialog
 * holds no focusable control of its own.
 */
export function useDialogA11y({
  open,
  onClose,
}: DialogA11yOptions): RefObject<HTMLDivElement | null> {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // onClose is read through a ref so the effect below depends on `open`
  // ALONE. Callers routinely pass an inline arrow (`onClose={() => setOpen(
  // false)}`); with onClose in the dependency array, every parent re-render
  // would tear the effect down and set it up again, and "set up again"
  // includes moving focus back onto the panel. That is the exact failure mode
  // that makes a trapped dialog impossible to type into, and it would have
  // been invisible until someone tried to fill in a form inside one.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Identity for this dialog instance on the stack. A ref so it survives
  // re-renders: a new symbol each render would corrupt the stack.
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
      // Only the dialog on top reacts. A dialog underneath keeps its listener
      // registered so it takes over the moment the one above it closes.
      if (!isTopmost(id)) return;
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      const items = focusableWithin(panel);
      if (items.length === 0) {
        // Nothing to move to, so keep focus on the panel rather than letting
        // Tab walk out into the page behind the overlay.
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
      // The panel itself counts as OUTSIDE the ring: it is where focus lands
      // on open, and from there Tab must go to `first` and Shift+Tab to
      // `last`, which is what "outside" already produces.
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

    // Focus the panel rather than its first control. The panel carries the
    // accessible name, so a screen reader announces the dialog and its title
    // instead of jumping straight to an unexplained "Close" button.
    panel?.focus();

    return () => {
      const at = dialogStack.lastIndexOf(id);
      if (at !== -1) dialogStack.splice(at, 1);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      // Restore focus to the trigger, unless it has left the document in the
      // meantime (a row deleted by the dialog that opened over it).
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  return panelRef;
}
