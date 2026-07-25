/** @jest-environment jsdom */
// useAchievementUnlocks must seed silently on the first poll (no toast blast on
// load) and then fire exactly once per newly-unlocked id across subsequent polls.

import { renderHook } from "@testing-library/react";
import { useAchievementUnlocks } from "@/hooks/useAchievementUnlocks";
import type { Achievement } from "@/lib/stats/derive";

function ach(id: string, unlocked: boolean): Achievement {
  return {
    id,
    name: id,
    description: "",
    icon: "Medal",
    color: "cyan",
    unlocked,
    progress: unlocked ? 1 : 0,
    current: unlocked ? 1 : 0,
    target: 1,
    tier: "common",
    points: 10,
  };
}

describe("useAchievementUnlocks", () => {
  it("seeds silently on the first poll (no fire for already-unlocked)", () => {
    const onUnlock = jest.fn();
    renderHook(({ a }) => useAchievementUnlocks(a, onUnlock), {
      initialProps: { a: [ach("first-contact", true), ach("veteran", false)] },
    });
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it("fires once for a newly-unlocked achievement and not again", () => {
    const onUnlock = jest.fn();
    const { rerender } = renderHook(({ a }) => useAchievementUnlocks(a, onUnlock), {
      initialProps: { a: [ach("veteran", false)] },
    });

    rerender({ a: [ach("veteran", true)] });
    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(onUnlock.mock.calls[0][0].id).toBe("veteran");

    rerender({ a: [ach("veteran", true)] }); // same state on the next poll
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it("does not throw on undefined achievements", () => {
    const onUnlock = jest.fn();
    expect(() => renderHook(() => useAchievementUnlocks(undefined, onUnlock))).not.toThrow();
    expect(onUnlock).not.toHaveBeenCalled();
  });
});
