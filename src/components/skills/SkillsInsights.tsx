"use client";

import { useMemo } from "react";
import { FileText, Check, Power, Layers } from "lucide-react";
import StatStrip from "@/components/viz/StatStrip";

/** Skills overview — active/inactive mix + category count for the selected profile. */
export default function SkillsInsights({ skills, activeCount }: { skills: Array<{ category?: string }>; activeCount: number }) {
  const s = useMemo(() => {
    const cats = new Set<string>();
    for (const sk of skills) if (sk.category) cats.add(sk.category);
    return { total: skills.length, active: activeCount, inactive: Math.max(0, skills.length - activeCount), categories: cats.size };
  }, [skills, activeCount]);

  if (skills.length === 0) return null;

  return (
    <StatStrip
      className="mb-5"
      donut={{
        segments: [
          { label: "Active", value: s.active, color: "green" },
          { label: "Inactive", value: s.inactive, color: "cyan" },
        ],
        center: s.total,
        centerSub: "skills",
      }}
      tiles={[
        { icon: FileText, label: "Total", value: s.total, color: "cyan" },
        { icon: Check, label: "Active", value: s.active, color: "green" },
        { icon: Power, label: "Inactive", value: s.inactive, color: "orange" },
        { icon: Layers, label: "Categories", value: s.categories, color: "purple" },
      ]}
      ring={{
        value: s.total > 0 ? s.active / s.total : 0,
        color: "green",
        label: <span className="text-sm">{Math.round((s.active / Math.max(1, s.total)) * 100)}%</span>,
        sublabel: "active",
      }}
    />
  );
}
