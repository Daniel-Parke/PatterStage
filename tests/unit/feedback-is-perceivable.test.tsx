/** @jest-environment jsdom */
/**
 * T-0050 acceptance oracle — a mutation's outcome reaches the operator.
 *
 * The live QA pass named this as the single thing it would fix: "silent success
 * and silent failure look identical". It filed the evidence as three separate
 * observations (a dialog that stays open with no toast, a "Save & push" with no
 * confirmation, toasts that vanish mid-keystroke) and diagnosed none of them.
 *
 * There are two concrete causes, and both are in this one component.
 *
 * 1. THE TOAST RENDERS UNDERNEATH THE THING THAT TRIGGERED IT. The ladder is
 *    Toast `z-50`, Sheet backdrop `z-[60]`, Sheet panel `z-[61]`, Modal
 *    `z-[70]`. The Sheet is portaled to document.body and occupies the entire
 *    right edge, which is exactly where the toast is anchored, while the toast
 *    is rendered inline on the page. So every confirmation of a mutation made
 *    from inside a sheet or a modal is covered by it. "No toast appeared" was an
 *    accurate observation of an invisible toast.
 *
 * 2. NOTHING ANNOUNCES IT. Toast carries no `role`, no `aria-live`. The whole
 *    application contains two live regions and neither is the path that serves
 *    73 `showToast` call sites. A screen reader is never told a mutation
 *    succeeded or failed, and a QA harness counting `[role=status]` finds zero
 *    and reasonably concludes nothing fired. This is the same defect shape as
 *    T-0036, where Modal announced itself as a plain div.
 *
 * And one design decision that predates both: `duration = 4000` applies to
 * ERRORS as well as successes, so the reason a mutation failed destroys itself
 * in four seconds whether or not anyone was looking.
 */

import { act, render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";

import Modal from "@/components/ui/Modal";
import Sheet from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

const UI = join(__dirname, "..", "..", "src", "components", "ui");

/** The largest `z-N` / `z-[N]` in a component's source. */
function maxZ(file: string): number {
  const src = readFileSync(join(UI, file), "utf-8");
  const zs = [...src.matchAll(/z-\[(\d+)\]|z-(\d+)/g)].map((m) => Number(m[1] ?? m[2]));
  if (zs.length === 0) throw new Error(`no z-index found in ${file}`);
  return Math.max(...zs);
}

/** A harness that shows a toast on demand, inside a Sheet when asked. */
function Harness({
  sheet = false,
  modal = false,
  type = "success" as const,
}: {
  sheet?: boolean;
  modal?: boolean;
  type?: "success" | "error";
}) {
  const { showToast, toastElement, lastResult } = useToast();
  return (
    <div>
      <button onClick={() => showToast("the thing happened", type)}>fire</button>
      {sheet ? (
        <Sheet open onClose={() => undefined} title="Composer">
          <p>sheet body</p>
        </Sheet>
      ) : null}
      {modal ? (
        <Modal open onClose={() => undefined} title="Manage categories">
          <p>modal body</p>
        </Modal>
      ) : null}
      {/* Rendered inline rather than through a shared component, so that the
          accessibility, stacking and duration assertions above stay red for
          THEIR reasons rather than for a module that does not exist yet. */}
      {lastResult ? <span data-testid="last-result">{lastResult.message}</span> : null}
      {toastElement}
    </div>
  );
}

function fire() {
  act(() => {
    screen.getByText("fire").click();
  });
}

// Sheet reads window.matchMedia to pick its mobile layout, and jsdom does not
// implement it. `Object.defineProperty` rather than `jest.spyOn`, because
// spyOn throws on a property that does not exist in the first place.
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
});

describe("a toast is announced", () => {
  it("uses a polite live region for a success", () => {
    render(<Harness />);
    fire();
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("the thing happened");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("uses an assertive alert for an error, because a failure interrupts", () => {
    render(<Harness type="error" />);
    fire();
    const region = screen.getByRole("alert");
    expect(region).toHaveTextContent("the thing happened");
    expect(region).toHaveAttribute("aria-live", "assertive");
  });

  it("names its dismiss control", () => {
    render(<Harness />);
    fire();
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
  });
});

describe("a toast is visible", () => {
  it("stacks above every overlay that can cover it", () => {
    const toast = maxZ("Toast.tsx");
    expect(toast).toBeGreaterThan(maxZ("Sheet.tsx"));
    expect(toast).toBeGreaterThan(maxZ("Modal.tsx"));
  });

  it("portals to the body, so no ancestor stacking context can trap it", () => {
    // A z-index alone is not enough: any ancestor with a transform, a filter or
    // a backdrop-blur creates a stacking context the toast cannot escape, and
    // this app uses backdrop-blur on its overlays.
    render(<Harness />);
    fire();
    const region = screen.getByRole("status");
    expect(region.closest("[data-testid='page-root']")).toBeNull();
    expect(document.body.contains(region)).toBe(true);
  });

  it("is still reachable while a Sheet is open over it", () => {
    render(<Harness sheet />);
    fire();
    expect(screen.getByRole("status")).toHaveTextContent("the thing happened");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("outranks the Modal, which is the tallest overlay in the app", () => {
    // Modal sits at z-[70], above the Sheet's z-[61], and unlike the Sheet it
    // renders inline rather than portaling. Both facts are covered: the toast
    // is a direct child of body AND numerically above, so no ordering of the
    // two can put the confirmation underneath the thing that produced it.
    render(<Harness modal />);
    fire();
    const region = screen.getByRole("status");
    expect(document.body.contains(region)).toBe(true);
    expect(region.parentElement).toBe(document.body);
    expect(maxZ("Toast.tsx")).toBeGreaterThan(maxZ("Modal.tsx"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("an error does not destroy its own explanation", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("keeps an error on screen past the success duration", () => {
    render(<Harness type="error" />);
    fire();
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("the thing happened");
  });

  it("still auto-dismisses a success", () => {
    render(<Harness />);
    fire();
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("the outcome survives the toast", () => {
  it("records the last result so a page can keep showing it", () => {
    render(<Harness />);
    fire();
    expect(screen.getByTestId("last-result")).toHaveTextContent(/the thing happened/i);
  });

  it("shows nothing before anything has happened", () => {
    render(<Harness />);
    expect(screen.queryByTestId("last-result")).toBeNull();
  });

  it("outlives the toast it came from", () => {
    jest.useFakeTimers();
    render(<Harness />);
    fire();
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByTestId("last-result")).toHaveTextContent(/the thing happened/i);
    jest.useRealTimers();
  });
});
