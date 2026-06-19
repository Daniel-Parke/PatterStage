"use client";

import { useMemo } from "react";
import { Boxes, Layers, KeyRound } from "lucide-react";
import StatStrip from "@/components/viz/StatStrip";
import type { DonutSegment } from "@/components/viz/Donut";
import type { NeonColor } from "@/components/viz/colors";

const CYCLE: NeonColor[] = ["cyan", "green", "purple", "orange", "pink", "yellow"];

/**
 * Model registry overview — provider-mix donut + count tiles. Provider colors
 * cycle the neon palette (providers are arbitrary strings). Hidden when empty.
 */
export default function ModelInsights({
  models,
  credentialCount,
}: {
  models: { provider: string }[];
  credentialCount: number;
}) {
  const s = useMemo(() => {
    const byProvider = new Map<string, number>();
    for (const m of models) byProvider.set(m.provider, (byProvider.get(m.provider) ?? 0) + 1);
    const entries = [...byProvider.entries()].sort((a, b) => b[1] - a[1]);
    return { total: models.length, providers: byProvider.size, entries };
  }, [models]);

  if (models.length === 0) return null;
  const segments: DonutSegment[] = s.entries
    .slice(0, 6)
    .map(([label, value], i) => ({ label, value, color: CYCLE[i % CYCLE.length] }));

  return (
    <StatStrip
      className="mb-5"
      donut={{ segments, center: s.total, centerSub: "models" }}
      tiles={[
        { icon: Boxes, label: "Models", value: s.total, color: "cyan" },
        { icon: Layers, label: "Providers", value: s.providers, color: "green" },
        { icon: KeyRound, label: "Credentials", value: credentialCount, color: "purple" },
      ]}
    />
  );
}
