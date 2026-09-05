/** @jest-environment jsdom */
/**
 * B2 (T-0096), D122: Toast had one slot. T-0050 made an error toast persist
 * "because it is the only place its own reason appears", and then any later
 * showToast, a routine success from a background poll included, replaced it
 * before it was read. The feedback surface is now a stack owned by ONE
 * shell-level provider: three toasts at most, and a success never evicts an
 * error. The provider also owns the achievement-unlock toast, which used to be
 * the dashboard's and therefore fired only while the dashboard was open.
 */
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";

const mockUseStats = jest.fn();
jest.mock("@/hooks/useStats", () => ({ useStats: () => mockUseStats() }));

import { FeedbackProvider } from "@/components/providers/FeedbackProvider";
import { useToast } from "@/components/ui/Toast";

const ROOT = join(__dirname, "..", "..");

function wrapper({ children }: { children: ReactNode }) {
  return <FeedbackProvider>{children}</FeedbackProvider>;
}

beforeEach(() => {
  mockUseStats.mockReturnValue({ stats: undefined, isLoading: false, error: null, refetch: jest.fn() });
});

const toasts = () => screen.queryAllByTestId("toast");

describe("the stack", () => {
  it("shows three toasts at once", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.showToast("one", "success");
      result.current.showToast("two", "info");
      result.current.showToast("three", "success");
    });
    expect(toasts().map((t) => t.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("one"), expect.stringContaining("two"), expect.stringContaining("three")]),
    );
    expect(toasts()).toHaveLength(3);
  });

  it("never lets a success evict an error", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.showToast("write refused: disk full", "error");
      result.current.showToast("saved", "success");
      result.current.showToast("synced", "success");
      result.current.showToast("polled", "success");
    });
    const texts = toasts().map((t) => t.textContent ?? "");
    expect(toasts()).toHaveLength(3);
    expect(texts.some((t) => t.includes("disk full"))).toBe(true);
    // The oldest SUCCESS went, not the error.
    expect(texts.some((t) => t.includes("saved"))).toBe(false);
  });

  it("caps at three even when every one is an error", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      for (let i = 1; i <= 5; i++) result.current.showToast(`error ${i}`, "error");
    });
    expect(toasts()).toHaveLength(3);
    expect(toasts().map((t) => t.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("error 5")]),
    );
  });

  it("dismisses one without touching the others", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.showToast("keep me", "error");
      result.current.showToast("drop me", "error");
    });
    const drop = toasts().find((t) => t.textContent?.includes("drop me"))!;
    fireEvent.click(within(drop).getByRole("button", { name: /dismiss/i }));
    act(() => {
      jest.advanceTimersByTime?.(0);
    });
    expect(toasts().some((t) => t.textContent?.includes("keep me"))).toBe(true);
  });

  it("announces an error as an alert and a success as a status", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.showToast("boom", "error");
      result.current.showToast("fine", "success");
    });
    expect(screen.getByRole("alert")).toHaveTextContent("boom");
    expect(screen.getByRole("status")).toHaveTextContent("fine");
  });
});

describe("useToast under the provider", () => {
  it("renders nothing of its own (the provider renders the stack) and still keeps lastResult", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => result.current.showToast("saved", "success"));
    expect(result.current.toastElement).toBeNull();
    expect(result.current.lastResult?.message).toBe("saved");
    expect(toasts()).toHaveLength(1);
  });

  it("falls back to the local single slot when no provider is mounted, so an unwrapped page still speaks", () => {
    // The 20 existing page tests render without the shell. They keep working,
    // and the fallback stays the old behaviour so nothing is silently muted.
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast("hello", "success"));
    expect(result.current.toastElement).not.toBeNull();
  });
});

describe("achievement unlocks belong to the shell", () => {
  it("toasts a newly unlocked achievement on any page, after the first poll seeds silently", () => {
    const seed = { stats: { achievements: [{ id: "a", name: "First Steps", unlocked: true }] } };
    mockUseStats.mockReturnValue(seed);
    const view = render(
      <FeedbackProvider>
        <div>page</div>
      </FeedbackProvider>,
    );
    expect(toasts()).toHaveLength(0);
    mockUseStats.mockReturnValue({
      stats: {
        achievements: [
          { id: "a", name: "First Steps", unlocked: true },
          { id: "b", name: "Clockmaker", unlocked: true },
        ],
      },
    });
    view.rerender(
      <FeedbackProvider>
        <div>page</div>
      </FeedbackProvider>,
    );
    expect(toasts().map((t) => t.textContent)).toEqual([expect.stringContaining("Clockmaker")]);
  });

  it("the dashboard no longer owns it", () => {
    // The Command Center left the dashboard with B5 (T-0099); the Progress
    // line and the page itself are what could take the hook back.
    for (const file of [["src", "app", "page.tsx"], ["src", "components", "dashboard", "ProgressLine.tsx"]]) {
      const src = readFileSync(join(ROOT, ...file), "utf-8");
      expect(src).not.toMatch(/useAchievementUnlocks/);
    }
  });

  it("the shell mounts the provider once, in the root layout", () => {
    const layout = readFileSync(join(ROOT, "src", "app", "layout.tsx"), "utf-8");
    expect(layout).toMatch(/<FeedbackProvider>/);
  });
});

// B17 (T-0111) hung the second of the shell's two automatic toasts here, on
// the same poll and the same rules. It is a child of the provider rather than
// a hook inside it, because it asks for a toast the way a page does.
describe("quest completions belong to the shell too", () => {
  interface Quest {
    id: string;
    title: string;
    completed: boolean;
    skipped: boolean;
  }

  const quest = (over: Partial<Quest> = {}): Quest => ({
    id: "1.1",
    title: "Add a model",
    completed: false,
    skipped: false,
    ...over,
  });

  function poll(quests: Quest[], seeding = false) {
    mockUseStats.mockReturnValue({ stats: { quests: { quests, seeding } } });
  }

  function shell() {
    return render(
      <FeedbackProvider>
        <div>page</div>
      </FeedbackProvider>,
    );
  }

  it("says nothing on the first poll, whatever is already finished", () => {
    poll([quest({ completed: true }), quest({ id: "1.2", title: "Add a credential", completed: true })]);
    shell();
    expect(toasts()).toHaveLength(0);
  });

  it("toasts the quest that finished since the last poll, once, by name", () => {
    poll([quest({ completed: true }), quest({ id: "1.2", title: "Add a credential" })]);
    const view = shell();

    poll([quest({ completed: true }), quest({ id: "1.2", title: "Add a credential", completed: true })]);
    view.rerender(
      <FeedbackProvider>
        <div>page</div>
      </FeedbackProvider>,
    );
    expect(toasts().map((t) => t.textContent)).toEqual([
      expect.stringContaining("Quest complete: Add a credential"),
    ]);

    // The same answer arriving again is the same quest, not a second one.
    view.rerender(
      <FeedbackProvider>
        <div>page</div>
      </FeedbackProvider>,
    );
    expect(toasts()).toHaveLength(1);
  });

  it("says nothing at all on a seeding poll, so a fresh install is not greeted with five toasts", () => {
    poll([quest()]);
    const view = shell();

    poll([quest({ completed: true }), quest({ id: "1.2", title: "Add a credential", completed: true })], true);
    view.rerender(
      <FeedbackProvider>
        <div>page</div>
      </FeedbackProvider>,
    );
    expect(toasts()).toHaveLength(0);
  });

  it("never congratulates an operator for a quest they skipped", () => {
    poll([quest({ id: "1.2", title: "Add a credential", skipped: true })]);
    const view = shell();

    poll([quest({ id: "1.2", title: "Add a credential", completed: true, skipped: true })]);
    view.rerender(
      <FeedbackProvider>
        <div>page</div>
      </FeedbackProvider>,
    );
    expect(toasts()).toHaveLength(0);
  });

  it("carries no emoji and no dash in its copy", () => {
    poll([quest()]);
    const view = shell();
    poll([quest({ completed: true })]);
    view.rerender(
      <FeedbackProvider>
        <div>page</div>
      </FeedbackProvider>,
    );
    const text = toasts()[0]?.textContent ?? "";
    expect(text).toContain("Quest complete: Add a model");
    expect(text).not.toMatch(/[–—\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
