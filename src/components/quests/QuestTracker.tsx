// ═══════════════════════════════════════════════════════════════
// QuestTracker — the shell's quest toast
//
// Renders nothing. It is mounted INSIDE FeedbackProvider's own context so it
// can call useToast(), and it reads the same 20-second stats poll the dashboard
// already runs, so it costs no request: react-query dedupes it.
//
// The rules are useAchievementUnlocks' rules, because they were learned the
// same way. A page load must never blast a toast for a quest that was finished
// last week, so the first poll seeds the baseline and fires nothing; each id
// fires at most once for the life of the mount.
//
// It also watches for the SERVER's half of the same rule. `quests.seeding` is
// true on the very first evaluation of an install, before the latch has ever
// been written, and on that poll everything the metrics already prove looks
// new. Firing there would greet a fresh install that happens to have five
// quests already met with five toasts at once, so a seeding poll only ever
// seeds. A skipped quest never toasts: the operator said they were not doing
// it, and congratulating them for it is noise.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useRef } from "react";

import { useToast } from "@/components/ui/Toast";
import { useStats } from "@/hooks/useStats";

export default function QuestTracker() {
  const { stats } = useStats();
  const { showToast } = useToast();
  const quests = stats?.quests;

  // null = uninitialised (the first poll seeds, fires nothing).
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!quests) return;
    const done = quests.quests.filter((q) => q.completed && !q.skipped);

    if (seen.current === null || quests.seeding) {
      seen.current = new Set(done.map((q) => q.id));
      return;
    }

    for (const quest of done) {
      if (!seen.current.has(quest.id)) {
        seen.current.add(quest.id);
        showToast(`Quest complete: ${quest.title}`, "success");
      }
    }
  }, [quests, showToast]);

  return null;
}
