"use client";

import { useMemo } from "react";
import { Brain, Clock, Archive, Tag } from "lucide-react";
import StatStrip from "@/components/viz/StatStrip";

/**
 * Hindsight memory overview — fresh/stale fact mix + unique tag count for
 * the currently-loaded memory set. Mirrors SkillsInsights/
 * PersonalitiesInsights (StatStrip donut + tiles + ring). `hiddenStaleCount`
 * is the number of loaded facts the age filter is hiding (stale).
 */
export default function MemoryInsights({
  memories,
  hiddenStaleCount,
}: {
  // Memory.tags is typed `unknown` upstream; coerced defensively below.
  memories: Array<{ tags?: unknown }>;
  hiddenStaleCount: number;
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

  return (
    <StatStrip
      className="mb-6"
      donut={{
        segments: [
          { label: "Fresh", value: s.fresh, color: "green" },
          { label: "Stale", value: s.stale, color: "orange" },
        ],
        center: s.total,
        centerSub: "facts",
      }}
      tiles={[
        { icon: Brain, label: "Facts", value: s.total, color: "pink" },
        { icon: Clock, label: "Fresh", value: s.fresh, color: "green" },
        { icon: Archive, label: "Stale", value: s.stale, color: "orange" },
        { icon: Tag, label: "Tags", value: s.tags, color: "purple" },
      ]}
      ring={{
        value: s.total > 0 ? s.fresh / s.total : 0,
        color: "green",
        label: <span className="text-sm">{Math.round((s.fresh / Math.max(1, s.total)) * 100)}%</span>,
        sublabel: "fresh",
      }}
    />
  );
}
