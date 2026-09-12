/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U11 (T-0125): Dialog, the one overlay.
 *
 * Modal and Sheet already share useDialogA11y and are correct; what they do
 * not share is their chrome, and the two Models overlays that hand-rolled the
 * chrome a third and fourth time (FallbackUrlEditModal, ModelSyncButtons)
 * each spelled their own backdrop, panel, header and footer. Dialog is the
 * chrome with a placement, and Modal and Sheet become two names for it, so
 * their consumers and their contract suites are untouched (T-0122 deferred
 * this until the third shape was known; it is: `center`, `right`, `bottom`,
 * and `sheet`, which is right on a desktop and bottom on a phone).
 */
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());

import Dialog from "@/components/ui/Dialog";
import Modal from "@/components/ui/Modal";
import Sheet from "@/components/ui/Sheet";

describe("Dialog carries the contract", () => {
  it("is a modal dialog labelled by its own heading, with a named close", () => {
    render(
      <Dialog open onClose={jest.fn()} title="Edit override base URL">
        <p>body</p>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Edit override base URL" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const heading = document.getElementById(dialog.getAttribute("aria-labelledby")!);
    expect(heading?.tagName).toBe("H2");
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeInTheDocument();
  });

  it("takes an explicit heading id, so a consumer that pins one keeps it", () => {
    render(
      <Dialog open onClose={jest.fn()} title="Push to Hermes" titleId="model-sync-title">
        <p>body</p>
      </Dialog>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-labelledby", "model-sync-title");
    expect(document.getElementById("model-sync-title")?.textContent).toBe("Push to Hermes");
  });

  it("without a title, it is labelled by the label it is given", () => {
    render(
      <Dialog open onClose={jest.fn()} ariaLabel="Reading settings">
        <p>body</p>
      </Dialog>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "Reading settings");
  });

  it("renders nothing while closed and closes on Escape", () => {
    const onClose = jest.fn();
    const { rerender } = render(
      <Dialog open={false} onClose={onClose} title="T">
        <p>body</p>
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(
      <Dialog open onClose={onClose} title="T">
        <p>body</p>
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a centred dialog does not close on a backdrop click; a sheet does", () => {
    const onClose = jest.fn();
    const { unmount } = render(
      <Dialog open onClose={onClose} title="Form">
        <p>body</p>
      </Dialog>,
    );
    expect(screen.queryByRole("button", { name: "Close overlay" })).toBeNull();
    unmount();
    render(
      <Dialog open onClose={onClose} title="Detail" placement="right">
        <p>body</p>
      </Dialog>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close overlay" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("puts the footer after the body", () => {
    render(
      <Dialog open onClose={jest.fn()} title="T" footer={<button type="button">Footer action</button>}>
        <p>the body</p>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    const body = screen.getByText("the body");
    const footer = screen.getByRole("button", { name: "Footer action" });
    expect(dialog.contains(body) && dialog.contains(footer)).toBe(true);
    expect(body.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("Modal and Sheet are Dialog", () => {
  it("Modal is the centred dialog, named by its h2 and closed by 'Close dialog'", () => {
    render(
      <Modal open onClose={jest.fn()} title="Review before launch">
        <p>Modal body</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: /Review before launch/ });
    expect(dialog.getAttribute("data-placement")).toBe("center");
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeInTheDocument();
  });

  it("Sheet is the side dialog, labelled by its title, with the overlay and 'Close panel'", () => {
    render(
      <Sheet open onClose={jest.fn()} title="Run detail" side="right">
        <p>Sheet body</p>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Run detail");
    expect(dialog.getAttribute("data-placement")).toBe("right");
    expect(screen.getByRole("button", { name: "Close overlay" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close panel" })).toBeInTheDocument();
  });
});
