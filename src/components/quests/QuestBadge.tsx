// ═══════════════════════════════════════════════════════════════
// QuestBadge — how many quests are left, in the rail
//
// Rides inside the rail's Quests link and reads the same deduped stats poll
// every other quest surface reads, so it adds no request of its own and the
// Sidebar never waits on anything: while stats are unread it renders nothing,
// and the rail is the width it always was.
//
// It renders nothing once every quest is done, too. A counter that reads 32/32
// forever is a nag with nothing left to nag about, and the rail has no pixels
// to spare for it.
//
// Collapsed, it is a DOT rather than "n/N". The icons-only rail is 64px wide
// and its footer stacks the two utility links vertically; three characters of
// mono text there would widen the row or wrap it, while a dot rides beside the
// icon and changes neither the rail's width nor its height. The rail has to
// fit 1280x720 without scrolling (tests/e2e/rail-no-scroll.spec.ts).
//
// Decorative, deliberately. The link it sits in carries its own aria-label
// ("Quests"), which is the accessible name a screen reader hears and which
// D119 pins; a second name inside it would be ignored, and a live region in
// the rail would re-announce a count on a twenty-second poll. The count is
// said in full on the page the link opens, and in a title for a hover.
// ═══════════════════════════════════════════════════════════════

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
      className="flex-shrink-0 font-mono text-xs text-neon-orange"
    >
      {quests.completed}/{quests.total}
    </span>
  );
}
