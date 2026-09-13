/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U14 · The focus trap skips what is not drawn.
 *
 * useDialogA11y's ring is every focusable element inside the panel, by
 * selector, and the trap acts only at the ring's two ends: Tab on the last
 * wraps to the first, Shift+Tab on the first wraps to the last. In between,
 * the browser's own Tab does the walking, and the browser skips anything
 * `display: none` by itself. So a hidden control in the MIDDLE of a panel is
 * harmless, and a hidden control at an END is the leak: the trap thinks the
 * ring has one more stop, never intercepts Tab from the last drawn control,
 * and the browser walks straight out of the panel to the next tabbable thing
 * in the document.
 *
 * That is the rail's collapse button, `hidden lg:flex`, the last control in
 * the drawer on a phone. Tab from the control before it left the open drawer
 * for the hamburger behind the backdrop. The recon watched it; the b2 suite
 * could not, because jsdom does no layout and every element there is equally
 * undrawn.
 *
 * The fix is the one the hook's own comment argued against: filter by
 * `getClientRects().length`, which is zero for anything `display: none` and
 * for anything inside it, GUARDED so that when nothing in the panel has a
 * rect at all, which is jsdom's world, the ring is the unfiltered list. The
 * guard is what lets the existing dialog suites keep asserting the trap
 * without stubbing layout, and what this suite stubs to see the filter work.
 */

import { fireEvent, render, screen } from "@testing-library/react";

import Dialog from "@/components/ui/Dialog";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());

function Harness() {
  return (
    <Dialog open onClose={() => {}} title="Trap">
      <button type="button">Alpha</button>
      <button type="button">Omega</button>
      {/* Last in the panel and drawn nowhere, like the collapse button on a phone. */}
      <button type="button" className="hidden">
        Ghost
      </button>
    </Dialog>
  );
}

const realGetClientRects = Element.prototype.getClientRects;

/** A layout: everything has a box except what is `hidden`. */
function stubLayout() {
  Element.prototype.getClientRects = function getClientRects(this: Element) {
    const drawn = !this.classList.contains("hidden") && !this.closest(".hidden");
    const list = drawn ? [{ x: 0, y: 0, width: 10, height: 10 }] : [];
    return list as unknown as DOMRectList;
  };
}

afterEach(() => {
  Element.prototype.getClientRects = realGetClientRects;
});

describe("U14 · the trap skips what is not drawn", () => {
  it("Tab from the last DRAWN control wraps to the first, rather than walking out", () => {
    stubLayout();
    render(<Harness />);
    const closeX = screen.getByRole("button", { name: "Close dialog" });
    const omega = screen.getByRole("button", { name: "Omega" });

    omega.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeX);
  });

  it("Shift+Tab from the first control lands on the last DRAWN control", () => {
    stubLayout();
    render(<Harness />);
    const closeX = screen.getByRole("button", { name: "Close dialog" });
    const omega = screen.getByRole("button", { name: "Omega" });

    closeX.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(omega);
  });

  it("with no layout at all, jsdom's world, the ring is DOM order and nothing is dropped", () => {
    render(<Harness />);
    const closeX = screen.getByRole("button", { name: "Close dialog" });
    const ghost = screen.getByRole("button", { name: "Ghost" });

    ghost.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeX);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(ghost);
  });
});
