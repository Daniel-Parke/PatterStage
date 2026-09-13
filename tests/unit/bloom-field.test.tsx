/** @jest-environment jsdom */

/**
 * The bloom tier (T-0024, warrant WG-WEB-011 ruled C, WG-WEB-005 ruled C).
 *
 * The acceptance sentence for the whole piece is "brightness is not decoration
 * but a readout of energy in the system". The half of that this file can hold
 * is the readout half: --bloom goes to 1 on the container under the pointer and
 * back to 0 when the pointer leaves it, so an idle console is dim.
 *
 * The other half these tests exist for is the two opt-outs, which are the part
 * of a vendored file most likely to be quietly lost in a later refactor:
 *
 *   - reduced motion. Not optional. A field that ignores it is an
 *     accessibility defect, and this repo honours the preference elsewhere
 *     (src/components/motion/index.tsx, globals.css:222).
 *   - coarse pointers. A touch device has no cursor to answer, and without the
 *     guard the listener would light a container on tap and leave it lit.
 *
 * Both are belt and braces by design: the listener refuses to attach, AND the
 * paint rule refuses to paint (globals.css). This file tests the listener; the
 * paint rule is CSS and is asserted by reading it, not by jsdom, which computes
 * no media queries.
 */

import { render, act } from "@testing-library/react";
import BloomField from "@/kit/BloomField";

/** jsdom ships no matchMedia. Install one that answers the two queries the field asks. */
function stubMatchMedia({ fine, reduce }: { fine: boolean; reduce: boolean }) {
  const impl = (query: string): MediaQueryList => {
    const matches = query.includes("prefers-reduced-motion") ? reduce : fine;
    return {
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    } as unknown as MediaQueryList;
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: jest.fn(impl),
  });
}

/**
 * A pointermove at a point inside `el`. jsdom gives every element a zero-size
 * rect, and the field bails on a zero-size rect by design, so the rect is
 * stubbed to something real. 200x100 at the origin keeps the arithmetic
 * checkable by hand.
 */
function pointerMoveOver(el: HTMLElement, clientX: number, clientY: number) {
  jest.spyOn(el, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 100,
    width: 200, height: 100, toJSON: () => ({}),
  } as DOMRect);
  const event = new Event("pointermove", { bubbles: true }) as PointerEvent;
  Object.defineProperty(event, "target", { value: el, configurable: true });
  Object.defineProperty(event, "clientX", { value: clientX, configurable: true });
  Object.defineProperty(event, "clientY", { value: clientY, configurable: true });
  act(() => {
    document.dispatchEvent(event);
  });
}

/** The field coalesces moves onto a frame, so a test has to let the frame run. */
function runFrame() {
  act(() => {
    jest.runOnlyPendingTimers();
  });
}

describe("BloomField", () => {
  let container: HTMLElement;

  beforeEach(() => {
    // rAF via fake timers, so "next frame" is deterministic rather than a race.
    jest.useFakeTimers();
    jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) =>
        setTimeout(() => cb(performance.now()), 16) as unknown as number,
      );
    jest
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation((id: number) => clearTimeout(id as unknown as NodeJS.Timeout));

    container = document.createElement("div");
    container.setAttribute("data-bloom", "");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders nothing", () => {
    stubMatchMedia({ fine: true, reduce: false });
    const { container: mounted } = render(<BloomField />);
    expect(mounted.innerHTML).toBe("");
  });

  describe("on a fine pointer with motion allowed", () => {
    beforeEach(() => stubMatchMedia({ fine: true, reduce: false }));

    it("lights the container under the pointer and records where the pointer is", () => {
      render(<BloomField />);
      pointerMoveOver(container, 50, 25);
      runFrame();

      expect(container.style.getPropertyValue("--bloom")).toBe("1");
      // 50 of 200 across, 25 of 100 down.
      expect(container.style.getPropertyValue("--bx")).toBe("25.00%");
      expect(container.style.getPropertyValue("--by")).toBe("25.00%");
    });

    it("resolves to the INNERMOST data-bloom container, so a row wins over its panel", () => {
      const row = document.createElement("div");
      row.setAttribute("data-bloom", "tight");
      container.appendChild(row);

      render(<BloomField />);
      pointerMoveOver(row, 100, 50);
      runFrame();

      expect(row.style.getPropertyValue("--bloom")).toBe("1");
      expect(container.style.getPropertyValue("--bloom")).toBe("");
    });

    it("darkens the container the pointer has left, so only one thing is lit", () => {
      const other = document.createElement("div");
      other.setAttribute("data-bloom", "");
      document.body.appendChild(other);

      render(<BloomField />);
      pointerMoveOver(container, 50, 25);
      runFrame();
      expect(container.style.getPropertyValue("--bloom")).toBe("1");

      pointerMoveOver(other, 50, 25);
      runFrame();
      expect(container.style.getPropertyValue("--bloom")).toBe("0");
      expect(other.style.getPropertyValue("--bloom")).toBe("1");
    });

    it("darkens everything when the pointer leaves the document: an idle console is dim", () => {
      render(<BloomField />);
      pointerMoveOver(container, 50, 25);
      runFrame();
      expect(container.style.getPropertyValue("--bloom")).toBe("1");

      act(() => {
        document.dispatchEvent(new Event("pointerleave", { bubbles: true }));
      });
      expect(container.style.getPropertyValue("--bloom")).toBe("0");
    });

    it("coalesces a burst of moves onto one frame", () => {
      render(<BloomField />);
      const rafSpy = window.requestAnimationFrame as unknown as jest.Mock;
      rafSpy.mockClear();

      for (let i = 0; i < 10; i += 1) pointerMoveOver(container, 10 * i, 25);
      expect(rafSpy).toHaveBeenCalledTimes(1);

      runFrame();
      // The LAST position of the burst is the one painted, not the first.
      expect(container.style.getPropertyValue("--bx")).toBe("45.00%");
    });

    it("stops listening when unmounted, so a remount cannot stack listeners", () => {
      const { unmount } = render(<BloomField />);
      unmount();

      pointerMoveOver(container, 50, 25);
      runFrame();
      expect(container.style.getPropertyValue("--bloom")).toBe("");
    });
  });

  it("does not attach at all under prefers-reduced-motion", () => {
    stubMatchMedia({ fine: true, reduce: true });
    render(<BloomField />);

    pointerMoveOver(container, 50, 25);
    runFrame();

    expect(container.style.getPropertyValue("--bloom")).toBe("");
    expect(container.style.getPropertyValue("--bx")).toBe("");
  });

  it("does not attach at all on a coarse pointer", () => {
    stubMatchMedia({ fine: false, reduce: false });
    render(<BloomField />);

    pointerMoveOver(container, 50, 25);
    runFrame();

    expect(container.style.getPropertyValue("--bloom")).toBe("");
    expect(container.style.getPropertyValue("--bx")).toBe("");
  });
});
