"use client";

import { useMemo } from "react";
import { Brain, AlignLeft, Maximize2 } from "lucide-react";
import StatStrip from "@/components/viz/StatStrip";

/** Personalities overview — count, active, and prompt-length stats. */
export default function PersonalitiesInsights({
  personalities,
}: {
  personalities: Array<{ name: string; prompt: string }>;
}) {
  const s = useMemo(() => {
    const lengths = personalities.map((p) => p.prompt.length);
    const avg = lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0;
    return {
      total: personalities.length,
      avg,
      longest: lengths.length ? Math.max(...lengths) : 0,
    };
  }, [personalities]);

  if (personalities.length === 0) return null;

  return (
    <StatStrip
      className="mb-6"
      tiles={[
        { icon: Brain, label: "Personalities", value: s.total, color: "purple" },
        { icon: AlignLeft, label: "Avg chars", value: s.avg, color: "green", compact: true },
        { icon: Maximize2, label: "Longest", value: s.longest, color: "orange", compact: true },
      ]}
    />
  );
}
