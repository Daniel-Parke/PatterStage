// QuestBadge — how many quests are left, in the rail. It reads the same deduped
// stats poll every quest surface reads, renders nothing while stats are unread
// and nothing once every quest is done (32/32 forever is a nag).
//
// Collapsed, it is a DOT rather than "n/N": the 64px rail's footer stacks its
// links vertically and mono text there would widen or wrap the row; the rail
// must fit 1280x720 without scrolling (tests/e2e/rail-no-scroll.spec.ts).
// Decorative, deliberately: the link's own aria-label ("Quests") is the name
// D119 pins, a second name inside it would be ignored, and a live region would
// re-announce a count every poll. The count is said in full on the page and in a title.

"use client";

import { useStats } from "@/hooks/useStats";

export default function QuestBadge({ collapsed = false }: { collapsed?: boolean }) {
  const { stats } = useStats();
  const quests = stats?.quests;

  // Unread, empty, or finished: say nothing at all.
  if (!quests || quests.total <= 0 || quests.completed >= quests.total) return null;

  const label = `${quests.completed} of ${quests.total} quests complete`;

  if (collapsed) {
    return (
      <span
        data-testid="quest-badge"
        aria-hidden="true"
        title={label}
        className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-neon-orange"
      />
    );
  }

  return (
    <span
      data-testid="quest-badge"
      aria-hidden="true"
      title={label}
      className="flex-shrink-0 font-mono text-micro text-neon-orange"
    >
      {quests.completed}/{quests.total}
    </span>
  );
}
