/** @jest-environment jsdom */

// ═══════════════════════════════════════════════════════════════
// T-0036 · Characterisation for Sheet, which had no tests of its own.
//
// Sheet was the component that already had the role, the aria and the Escape
// handler; Modal had none of them. Rather than write a second Escape handler
// into Modal, the shared behaviour moved into useDialogA11y and both
// components now call it. That makes this a refactor of Sheet, and a refactor
// of an untested component is a change nobody can see go wrong.
//
// The first describe block is the behaviour Sheet had BEFORE the extraction,
// pinned so the extraction can be shown not to have moved it. It was verified
// green against the pre-change Sheet (git show HEAD:src/components/ui/
// Sheet.tsx) as well as against the extracted one.
//
// The second block is what Sheet GAINED: the focus trap and focus
// restoration it never had. Those fail against the pre-change file, which is
// the point of separating them.
// ═══════════════════════════════════════════════════════════════

import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import Sheet from "@/components/ui/Sheet";

// jsdom ships no window.matchMedia, and Sheet calls it on mount to choose
// between its bottom and right variants. This is why Sheet had no unit tests:
// rendering it threw before any assertion ran. Stubbed locally rather than in
// tests/jest.setup.ts, because a global stub would change what every other
// suite sees. Fixed to desktop; `side` is passed explicitly where it matters.
const originalMatchMedia = window.matchMedia;

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterAll(() => {
  window.matchMedia = originalMatchMedia;
});

describe("Sheet · behaviour preserved across the useDialogA11y extraction", () => {
  it("renders a labelled, modal dialog with its title, subtitle and footer", () => {
    render(
      <Sheet
        open
        onClose={jest.fn()}
        title="Run detail"
        subtitle="stage 2 of 5"
        footer={<button type="button">Footer action</button>}
        side="right"
      >
        <p>Sheet body</p>
      </Sheet>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Run detail");
    expect(screen.getByText("Run detail")).toBeInTheDocument();
    expect(screen.getByText("stage 2 of 5")).toBeInTheDocument();
    expect(screen.getByText("Sheet body")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Footer action" }),
    ).toBeInTheDocument();
  });

  it("falls back to the generic label when it has no title", () => {
    render(
      <Sheet open onClose={jest.fn()}>
        <p>Sheet body</p>
      </Sheet>,
    );

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "Panel");
  });

  it("renders nothing while closed", () => {
    render(
      <Sheet open={false} onClose={jest.fn()} title="Run detail">
        <p>Sheet body</p>
      </Sheet>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Sheet body")).toBeNull();
  });

  it("closes on Escape, on the overlay and on the header X", () => {
    const onClose = jest.fn();
    render(
      <Sheet open onClose={onClose} title="Run detail">
        <p>Sheet body</p>
      </Sheet>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Close overlay" }));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("does not close on other keys, or on Escape while closed", () => {
    const onClose = jest.fn();
    const { rerender } = render(
      <Sheet open onClose={onClose} title="Run detail">
        <p>Sheet body</p>
      </Sheet>,
    );

    fireEvent.keyDown(document, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <Sheet open={false} onClose={onClose} title="Run detail">
        <p>Sheet body</p>
      </Sheet>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("locks body scroll while open and restores it on close", () => {
    document.body.style.overflow = "";
    const { rerender } = render(
      <Sheet open onClose={jest.fn()} title="Run detail">
        <p>Sheet body</p>
      </Sheet>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Sheet open={false} onClose={jest.fn()} title="Run detail">
        <p>Sheet body</p>
      </Sheet>,
    );
    expect(document.body.style.overflow).toBe("");
  });
});

describe("Sheet · what the shared hook adds", () => {
  function SheetHarness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open sheet
        </button>
        <Sheet open={open} onClose={() => setOpen(false)} title="Run detail">
          <button type="button">Inside one</button>
          <button type="button">Inside two</button>
        </Sheet>
      </>
    );
  }

  it("moves focus into the panel and restores it to the trigger", () => {
    render(<SheetHarness />);

    const trigger = screen.getByRole("button", { name: "Open sheet" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("wraps Tab inside the panel, leaving the overlay button out of the ring", () => {
    render(<SheetHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open sheet" }));

    const closeX = screen.getByRole("button", { name: "Close panel" });
    const insideTwo = screen.getByRole("button", { name: "Inside two" });

    insideTwo.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeX);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(insideTwo);

    // The overlay is a click target, not a tab stop: it sits outside the
    // panel, so the ring never reaches it.
    expect(document.activeElement).not.toBe(
      screen.getByRole("button", { name: "Close overlay" }),
    );
  });
});
