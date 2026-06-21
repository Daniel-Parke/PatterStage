"use client";

import { useMemo } from "react";
import { Brain, Sparkles, AlignLeft, Maximize2 } from "lucide-react";
import StatStrip from "@/components/viz/StatStrip";

/** Personalities overview — count, active, and prompt-length stats. */
export default function PersonalitiesInsights({
  personalities,
  activeName,
}: {
  personalities: Array<{ name: string; prompt: string }>;
  activeName: string;
}) {
  const s = useMemo(() => {
    const lengths = personalities.map((p) => p.prompt.length);
    const avg = lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0;
    return {
      total: personalities.length,
      // One personality is active at a time; count it whenever an active name is
      // set (a strict name-in-list match mis-reported 0 on a slug/case mismatch).
      active: activeName && activeName.trim().length > 0 ? 1 : 0,
      avg,
      longest: lengths.length ? Math.max(...lengths) : 0,
    };
  }, [personalities, activeName]);

  if (personalities.length === 0) return null;

  return (
    <StatStrip
      className="mb-6"
      tiles={[
        { icon: Brain, label: "Personalities", value: s.total, color: "purple" },
        { icon: Sparkles, label: "Active", value: s.active, color: "cyan" },
        { icon: AlignLeft, label: "Avg chars", value: s.avg, color: "green", compact: true },
        { icon: Maximize2, label: "Longest", value: s.longest, color: "orange", compact: true },
      ]}
    />
  );
}
