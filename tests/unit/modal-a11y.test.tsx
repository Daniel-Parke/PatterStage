/** @jest-environment jsdom */

// ═══════════════════════════════════════════════════════════════
// T-0036 · The frozen acceptance oracle for Modal's accessibility contract.
//
// WHAT QA MEASURED, and what these tests re-measure:
//   On dev@43d16c30 the operator opened "Manage categories", "Edit Templates"
//   and the Composer "Review before launch" modal, ran
//   `document.querySelectorAll('[role=dialog]').length` and got 0 every time.
//   The controls WORKED; the modal simply announced itself as nothing, so a
//   text-scraping QA pass and a screen reader both concluded the button was
//   dead. Modal.tsx set no role, no aria-modal, no aria-labelledby, no focus
//   trap and no Escape handler, while its sibling Sheet.tsx had the role, the
//   aria and the Escape handler already.
//
// The first assertion in this file is QA's own one-liner, unchanged, because
// an oracle that measures something ADJACENT to the reported symptom is not an
// oracle for the reported symptom.
//
// The second half of the file is the risk this change carries rather than the
// bug it fixes. Modal is used by fourteen components, several of which render
// a form; a focus trap that steals focus back from an <input> on every render
// would leave every one of those forms untypeable. CategoryManagerModal and
// TemplateManagerModal are exercised through the REAL Modal (no jest.mock) for
// exactly that reason: they are two of the three controls QA called dead, and
// the first of them is a live form.
// ═══════════════════════════════════════════════════════════════

import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import Modal from "@/components/ui/Modal";
import Sheet from "@/components/ui/Sheet";
import CategoryManagerModal from "@/components/missions/CategoryManagerModal";
import { TemplateManagerModal } from "@/components/missions/templates/TemplateManagerModal";

/** A trigger button plus the modal it opens, so focus restoration has a real
 *  element to be restored TO. Mirrors how every real caller wires it. */
function TriggerHarness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Manage categories
      </button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
        title="Manage categories"
      >
        <p>Modal body</p>
      </Modal>
    </>
  );
}

describe("Modal · the accessibility contract Sheet already had", () => {
  it("puts at least one [role=dialog] in the document once open, QA's own measurement", () => {
    render(
      <Modal open onClose={jest.fn()} title="Manage categories">
        <p>Modal body</p>
      </Modal>,
    );

    // Byte-for-byte the query the operator ran in the live console.
    expect(
      document.querySelectorAll("[role=dialog]").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders no dialog at all while closed", () => {
    render(
      <Modal open={false} onClose={jest.fn()} title="Manage categories">
        <p>Modal body</p>
      </Modal>,
    );

    expect(document.querySelectorAll("[role=dialog]").length).toBe(0);
  });

  it("marks the dialog aria-modal and labels it from the existing h2", () => {
    render(
      <Modal open onClose={jest.fn()} title="Review before launch">
        <p>Modal body</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();

    // aria-labelledby must point at the heading that was ALREADY there
    // (Modal.tsx's <h2>), not at a duplicate label bolted on beside it.
    const heading = document.getElementById(labelledBy ?? "");
    expect(heading).not.toBeNull();
    expect(heading?.tagName).toBe("H2");
    expect(heading).toHaveTextContent("Review before launch");
    expect(heading).toBe(screen.getByRole("heading", { level: 2 }));

    // And the label must actually resolve, which is the whole point of it.
    expect(
      screen.getByRole("dialog", { name: /Review before launch/ }),
    ).toBe(dialog);
  });

  it("gives two open modals distinct heading ids", () => {
    render(
      <>
        <Modal open onClose={jest.fn()} title="First">
          <p>one</p>
        </Modal>
        <Modal open onClose={jest.fn()} title="Second">
          <p>two</p>
        </Modal>
      </>,
    );

    const [a, b] = screen.getAllByRole("dialog");
    const idA = a.getAttribute("aria-labelledby");
    const idB = b.getAttribute("aria-labelledby");
    expect(idA).toBeTruthy();
    expect(idB).toBeTruthy();
    expect(idA).not.toBe(idB);
  });

  it("moves focus into the dialog on open and restores it to the trigger on close", () => {
    render(<TriggerHarness />);

    const trigger = screen.getByRole("button", { name: "Manage categories" });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on Escape", () => {
    const onClose = jest.fn();
    render(
      <Modal open onClose={onClose} title="Manage categories">
        <p>Modal body</p>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores keys that are not Escape", () => {
    const onClose = jest.fn();
    render(
      <Modal open onClose={onClose} title="Manage categories">
        <p>Modal body</p>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Enter" });
    fireEvent.keyDown(document, { key: "a" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not listen for Escape while closed", () => {
    const onClose = jest.fn();
    render(
      <Modal open={false} onClose={onClose} title="Manage categories">
        <p>Modal body</p>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("traps Tab inside the dialog in both directions", () => {
    render(
      <>
        <button type="button">outside before</button>
        <Modal open onClose={jest.fn()} title="Trapped">
          <button type="button">first inside</button>
          <button type="button">last inside</button>
        </Modal>
        <button type="button">outside after</button>
      </>,
    );

    // The header's X is the first focusable thing in the panel; the body's
    // last button is the last.
    const closeX = screen.getByRole("button", { name: /close/i });
    const lastInside = screen.getByRole("button", { name: "last inside" });
    const outsideAfter = screen.getByRole("button", { name: "outside after" });

    // Forward off the end wraps to the start.
    lastInside.focus();
    expect(fireEvent.keyDown(document, { key: "Tab" })).toBe(false);
    expect(document.activeElement).toBe(closeX);

    // Backward off the start wraps to the end.
    closeX.focus();
    expect(
      fireEvent.keyDown(document, { key: "Tab", shiftKey: true }),
    ).toBe(false);
    expect(document.activeElement).toBe(lastInside);

    // Focus that has escaped the dialog entirely is pulled back in.
    outsideAfter.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeX);
  });

  it("locks body scroll while open and restores it on close", () => {
    document.body.style.overflow = "";
    const { rerender } = render(
      <Modal open onClose={jest.fn()} title="Manage categories">
        <p>Modal body</p>
      </Modal>,
    );

    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Modal open={false} onClose={jest.fn()} title="Manage categories">
        <p>Modal body</p>
      </Modal>,
    );

    expect(document.body.style.overflow).toBe("");
  });
});

// ── The two real usages QA called dead buttons ──────────────────────────────
//
// Rendered through the REAL Modal. If the focus trap or the Escape handler
// breaks a form, it breaks here.

describe("Modal · real usages keep working with the trap installed", () => {
  it("CategoryManagerModal announces a dialog and its form still accepts typing", async () => {
    const onCreateCategory = jest.fn().mockResolvedValue("ops-id");
    const onClose = jest.fn();

    render(
      <CategoryManagerModal
        open
        onClose={onClose}
        categories={[]}
        onRefresh={jest.fn()}
        onCreateCategory={onCreateCategory}
        onUpdate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(
      document.querySelectorAll("[role=dialog]").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole("dialog", { name: /Manage categories/ }),
    ).toBeInTheDocument();

    // The regression the trap could plausibly cause: focus yanked off the
    // input on every keystroke's re-render, leaving the field untypeable.
    const input = screen.getByPlaceholderText("Category name");
    input.focus();
    fireEvent.change(input, { target: { value: "Operations" } });
    expect(document.activeElement).toBe(input);
    expect((input as HTMLInputElement).value).toBe("Operations");

    fireEvent.click(screen.getByRole("button", { name: /Create category/i }));
    await waitFor(() => {
      expect(onCreateCategory).toHaveBeenCalledWith("Operations", "cyan");
    });

    // And Escape still reaches the caller from inside a live form.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("TemplateManagerModal announces a dialog labelled by its own heading", () => {
    const onClose = jest.fn();

    render(
      <TemplateManagerModal
        open
        onClose={onClose}
        templates={[]}
        categories={[]}
        categoryFilter="all"
        onEditTemplate={jest.fn()}
        onDeleteTemplate={jest.fn()}
        onCreateTemplate={jest.fn()}
      />,
    );

    expect(
      document.querySelectorAll("[role=dialog]").length,
    ).toBeGreaterThanOrEqual(1);

    const dialog = screen.getByRole("dialog");
    const heading = document.getElementById(
      dialog.getAttribute("aria-labelledby") ?? "",
    );
    expect(heading).toHaveTextContent("Edit Templates");

    // The footer's own "Close" button and the header X both still work.
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

/**
 * Stacked dialogs: only the one on top reacts to Escape.
 *
 * Found by review, and measured before it was fixed: on the missions page the
 * category modal opens OVER the composer sheet (opening it does not close the
 * sheet), both registered a document-level Escape listener, and ONE keypress
 * called BOTH onClose handlers. The operator dismissing the modal on top also
 * lost the half-filled mission composer behind it.
 *
 * Not a regression in outcome, which is why it did not block: before Modal had
 * any Escape handler at all, Escape already reached the sheet. But it is a real
 * way to lose work, so the invariant is pinned rather than left to mount order.
 */
describe("stacked dialogs", () => {
  // Sheet reads window.matchMedia for its mobile breakpoint and jsdom ships
  // none at all, so it is defined here rather than spied on (a spy throws
  // "Property matchMedia does not exist in the provided object").
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({
        matches: false, media: query, onchange: null,
        addEventListener: () => {}, removeEventListener: () => {},
        addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
      }),
    });
  });
  afterAll(() => {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  });

  function Stack({ onOuter, onInner, innerOpen }: { onOuter: () => void; onInner: () => void; innerOpen: boolean }) {
    return (
      <>
        <Sheet open onClose={onOuter} title="Composer">
          <input aria-label="mission name" />
        </Sheet>
        <Modal open={innerOpen} onClose={onInner} title="Manage categories">
          <input aria-label="category name" />
        </Modal>
      </>
    );
  }

  it("closes only the topmost dialog on Escape", async () => {
    const onOuter = jest.fn();
    const onInner = jest.fn();
    render(<Stack onOuter={onOuter} onInner={onInner} innerOpen />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onInner).toHaveBeenCalledTimes(1);
    // The one underneath must be untouched. This is the assertion that was
    // failing: it received the same keystroke and closed too.
    expect(onOuter).not.toHaveBeenCalled();
  });

  it("hands Escape back to the dialog underneath once the top one closes", async () => {
    const onOuter = jest.fn();
    const onInner = jest.fn();
    const { rerender } = render(<Stack onOuter={onOuter} onInner={onInner} innerOpen />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onInner).toHaveBeenCalledTimes(1);

    // The modal closes; the sheet is now topmost and must respond again.
    rerender(<Stack onOuter={onOuter} onInner={onInner} innerOpen={false} />);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onOuter).toHaveBeenCalledTimes(1);
    expect(onInner).toHaveBeenCalledTimes(1);
  });
});
