"use client";

import { useMemo } from "react";
import { Tag } from "lucide-react";
import StatStrip from "@/components/viz/StatStrip";

/**
 * Hindsight memory overview — fresh/stale fact mix + unique tag count for
 * the currently-loaded memory set. Mirrors SkillsInsights/
 * PersonalitiesInsights (StatStrip donut + tiles + ring). `hiddenStaleCount`
 * is the number of loaded facts the age filter is hiding (stale).
 *
 * The browser only loads a recent SAMPLE of facts (a page), so the donut +
 * fresh/stale describe that sample. `totalFacts` (from the provider health) is
 * the real store size — surfaced so "Facts" isn't read as the total when only
 * a page is loaded (e.g. 50 shown of 17,638 stored).
 */
export default function MemoryInsights({
  memories,
  hiddenStaleCount,
  totalFacts,
}: {
  // Memory.tags is typed `unknown` upstream; coerced defensively below.
  memories: Array<{ tags?: unknown }>;
  hiddenStaleCount: number;
  /** Real total fact count in the store (provider health); may exceed the loaded page. */
  totalFacts?: number | null;
}) {
  const s = useMemo(() => {
    const tagSet = new Set<string>();
    for (const m of memories) {
      if (!Array.isArray(m.tags)) continue;
      for (const t of m.tags) if (typeof t === "string") tagSet.add(t);
    }
    const total = memories.length;
    const stale = Math.min(Math.max(0, hiddenStaleCount), total);
    const fresh = Math.max(0, total - stale);
    return { total, fresh, stale, tags: tagSet.size };
  }, [memories, hiddenStaleCount]);

  if (s.total === 0) return null;

  const realTotal = typeof totalFacts === "number" && totalFacts > s.total ? totalFacts : null;

  return (
    <div className="mb-6">
      <StatStrip
        donut={{
          segments: [
            { label: "Fresh", value: s.fresh, color: "green" },
            { label: "Stale", value: s.stale, color: "orange" },
          ],
          center: realTotal ?? s.total,
          centerSub: "facts",
        }}
        // Fresh and Stale are the donut's two arcs, and the donut's centre is
        // ALREADY `realTotal ?? s.total` - so a "facts in store" tile is the
        // same number twice by construction, which is what a first pass at this
        // wrote before the rule caught it. Distinct tags is the one thing here
        // a freshness mix cannot say (T-0124).
        tiles={[
          { icon: Tag, label: "Distinct tags", value: s.tags, color: "purple" as const, hint: "Number of unique tag labels across the sampled facts — not the number of tagged facts." },
        ]}
        ring={{
          value: s.total > 0 ? s.fresh / s.total : 0,
          color: "green",
          label: <span className="text-body">{Math.round((s.fresh / Math.max(1, s.total)) * 100)}%</span>,
          sublabel: "fresh",
        }}
      />
      {realTotal ? (
        <p className="mt-2 text-center text-body text-ps-text-muted">
          Showing the {s.total.toLocaleString()} most recent of {realTotal.toLocaleString()} stored facts — the fresh/stale mix and tags reflect this sample.
        </p>
      ) : null}
    </div>
  );
}
