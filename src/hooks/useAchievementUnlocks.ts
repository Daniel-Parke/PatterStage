// ═══════════════════════════════════════════════════════════════
// useAchievementUnlocks — fire a callback when an achievement newly unlocks
//
// Diffs the unlocked set across useStats polls and calls onUnlock once per
// newly-unlocked id. The FIRST poll only seeds the baseline (so a page load
// never blasts a toast for every already-earned achievement), and each id
// fires at most once for the life of the component (per-id Set dedup across
// the 20s polls).
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useRef } from "react";
import type { Achievement } from "@/lib/stats/derive";

export function useAchievementUnlocks(
  achievements: Achievement[] | undefined,
  onUnlock: (a: Achievement) => void,
): void {
  // null = uninitialised (first poll seeds, fires nothing).
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!achievements) return;
    const unlocked = achievements.filter((a) => a.unlocked);

    if (seen.current === null) {
      seen.current = new Set(unlocked.map((a) => a.id));
      return;
    }

    for (const a of unlocked) {
      if (!seen.current.has(a.id)) {
        seen.current.add(a.id);
        onUnlock(a);
      }
    }
  }, [achievements, onUnlock]);
}
