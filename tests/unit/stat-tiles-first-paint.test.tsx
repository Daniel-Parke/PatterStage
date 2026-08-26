/**
 * @jest-environment jsdom
 *
 * T-0035 acceptance oracle: a stat tile must tell the truth on its FIRST
 * painted frame.
 *
 * The bug the operator found on dev@43d16c30 was not a data bug. `useCountUp`
 * seeded `useState(0)` and `useRef(0)` and then ramped toward the real figure
 * over 800ms, so the first frame of every tile was literally `0`, on /sessions
 * and on all three Operations pages. The give-away was the Tools "Platforms"
 * tile, which counts a hard-coded 7-element array and still painted 0, and the
 * Skills strip, which painted active:0 alongside inactive:0 where
 * inactive = 218 - active is arithmetically impossible.
 *
 * So the acceptance is deliberately SYNCHRONOUS: render, then assert, with no
 * timer advanced, no animation frame flushed and no `await` in between. There
 * is no window in which a tile is allowed to read zero.
 *
 * The ramp is a feature and must survive: the second and third blocks below
 * prove a LATER change still animates, and that a ramp interrupted part-way
 * resumes from the frame that was actually on screen rather than snapping back
 * toward the stale origin.
 */
import { act, render, renderHook, screen } from "@testing-library/react";

import StatStrip from "@/components/viz/StatStrip";
import { useCountUp } from "@/hooks/useCountUp";

/** Stand-in for the lucide icon each tile takes; the test asserts on numbers. */
function Dot({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={className} style={style} data-testid="tile-icon" />;
}

describe("stat tiles on first paint", () => {
  beforeEach(() => {
    // now: 0 so the fake clock's animation frames land on clean 16ms multiples.
    jest.useFakeTimers({ now: 0 });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("paints the real numbers synchronously, before any frame or timer runs", () => {
    const rafSpy = jest.spyOn(window, "requestAnimationFrame");

    render(
      <StatStrip
        tiles={[
          { icon: Dot, label: "Platforms", value: 7, color: "cyan" },
          { icon: Dot, label: "Active", value: 42, color: "green" },
          { icon: Dot, label: "Inactive", value: 176, color: "orange" },
          { icon: Dot, label: "Tokens", value: 4218, color: "purple" },
        ]}
      />,
    );

    // Nothing has been flushed: no timer advanced, no frame delivered. And on
    // a first paint there is nothing to animate, so no frame was even asked for.
    expect(rafSpy).not.toHaveBeenCalled();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("176")).toBeInTheDocument();
    expect(screen.getByText("4,218")).toBeInTheDocument();

    // And the specific lie is absent: no tile reads zero.
    expect(screen.queryByText("0")).not.toBeInTheDocument();

    rafSpy.mockRestore();
  });

  it("still paints the truth when the value is genuinely zero", () => {
    render(<StatStrip tiles={[{ icon: Dot, label: "Errors", value: 0, color: "pink" }]} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("ramps, rather than jumping, when the value LATER changes", () => {
    const { rerender } = render(
      <StatStrip tiles={[{ icon: Dot, label: "Runs", value: 100, color: "cyan" }]} />,
    );
    expect(screen.getByText("100")).toBeInTheDocument();

    rerender(<StatStrip tiles={[{ icon: Dot, label: "Runs", value: 200, color: "cyan" }]} />);
    // Still the old figure: a change starts a ramp, it does not teleport.
    expect(screen.getByText("100")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(400);
    });
    // Mid-ramp: neither endpoint is on screen, so the ramp really is running.
    expect(screen.queryByText("100")).not.toBeInTheDocument();
    expect(screen.queryByText("200")).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(screen.getByText("200")).toBeInTheDocument();
  });
});

describe("useCountUp", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns the target itself on the very first render", () => {
    const { result } = renderHook(() => useCountUp(4218));
    expect(result.current).toBe(4218);
  });

  it("does not schedule an animation on mount", () => {
    const rafSpy = jest.spyOn(window, "requestAnimationFrame");
    renderHook(() => useCountUp(4218));
    expect(rafSpy).not.toHaveBeenCalled();
    rafSpy.mockRestore();
  });

  it("animates a later change and lands exactly on the new target", () => {
    const { result, rerender } = renderHook(({ t }) => useCountUp(t, 800), {
      initialProps: { t: 0 },
    });
    expect(result.current).toBe(0);

    rerender({ t: 1000 });
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(1000);

    act(() => {
      jest.advanceTimersByTime(800);
    });
    expect(result.current).toBe(1000);
  });

  it("resumes an interrupted ramp from the frame on screen, not the stale origin", () => {
    const { result, rerender } = renderHook(({ t }) => useCountUp(t, 800), {
      initialProps: { t: 0 },
    });

    rerender({ t: 1000 });
    act(() => {
      jest.advanceTimersByTime(400);
    });
    const interruptedAt = result.current;
    expect(interruptedAt).toBeGreaterThan(0);
    expect(interruptedAt).toBeLessThan(1000);

    // A second change arrives mid-ramp. The effect cleanup must commit the
    // frame that was actually painted; if it commits nothing the next ramp
    // restarts from the stale origin and the tile visibly snaps toward zero.
    rerender({ t: 2000 });
    expect(result.current).toBe(interruptedAt);

    let previous = interruptedAt;
    for (let i = 0; i < 50; i++) {
      act(() => {
        jest.advanceTimersByTime(16);
      });
      expect(result.current).toBeGreaterThanOrEqual(previous);
      previous = result.current;
    }
    expect(result.current).toBe(2000);
  });

  it("commits instantly, with no ramp, under prefers-reduced-motion", () => {
    // jsdom ships no `matchMedia` at all, which is why the hook calls it
    // optionally. Define one for this test only, then take it away again.
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({ matches: query.includes("prefers-reduced-motion"), media: query }),
    });

    try {
      const rafSpy = jest.spyOn(window, "requestAnimationFrame");
      const { result, rerender } = renderHook(({ t }) => useCountUp(t, 800), {
        initialProps: { t: 5 },
      });
      expect(result.current).toBe(5);

      rerender({ t: 900 });
      expect(result.current).toBe(900);
      expect(rafSpy).not.toHaveBeenCalled();
      rafSpy.mockRestore();
    } finally {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });
});
