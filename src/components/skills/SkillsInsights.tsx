"use client";

import { useMemo } from "react";
import { groupByCategory } from "@/lib/skills-grouping";
import { Layers } from "lucide-react";
import StatStrip from "@/components/viz/StatStrip";

/** Skills overview — active/inactive mix + category count for the selected profile. */
export default function SkillsInsights({ skills, activeCount }: { skills: Array<{ category?: string }>; activeCount: number }) {
  const s = useMemo(() => {
    // Count categories by ASKING THE GROUPER, rather than re-implementing half
    // of it here. This tile sits directly above the category rows, so the two
    // must agree by construction: any private normalisation here is a second
    // source of truth that drifts the moment the real one changes.
    //
    // It did exactly that. This used to lowercase the raw string, which matched
    // groupByCategory only while that key was also a bare lowercase. T-0037
    // taught the key to fold hyphens, underscores and whitespace runs, so
    // "Control Hub" and "control-hub" became one row while this Set still
    // counted two, and the tile contradicted the list beneath it.
    return {
      total: skills.length,
      active: activeCount,
      inactive: Math.max(0, skills.length - activeCount),
      // "Other" matches the page's own grouping call (groupCategories in
      // skills-page-helpers), so an uncategorised skill lands in the same
      // bucket the list renders and the tile counts the rows that exist.
      categories: groupByCategory(
        skills.map((sk) => ({ category: sk.category ?? "" })),
        "Other",
      ).length,
    };
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
      // Active and Inactive are the donut's two arcs, and Total is the number
      // in its centre. Categories is the one thing here an active/inactive mix
      // cannot say (T-0124).
      tiles={[
        { icon: Layers, label: "Categories", value: s.categories, color: "purple", hint: "Distinct skill categories in this profile." },
      ]}
      ring={{
        value: s.total > 0 ? s.active / s.total : 0,
        color: "green",
        label: <span className="text-body">{Math.round((s.active / Math.max(1, s.total)) * 100)}%</span>,
        sublabel: "active",
      }}
    />
  );
}
