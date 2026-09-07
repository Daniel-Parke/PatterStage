"use client";

import { useMemo } from "react";
import { Layers } from "lucide-react";
import StatStrip from "@/components/viz/StatStrip";
import { HERMES_PLATFORMS } from "../lib/toolset-catalog";

/**
 * Toolsets overview for the selected profile — enabled/disabled mix out
 * of the configurable catalog, plus the number of gateway platforms the
 * enabled list fans out to on save. Mirrors SkillsInsights/
 * PersonalitiesInsights (StatStrip donut + tiles + ring).
 */
export default function ToolsInsights({ total, enabled }: { total: number; enabled: number }) {
  const s = useMemo(
    () => ({ total, enabled, disabled: Math.max(0, total - enabled) }),
    [total, enabled],
  );

  if (total === 0) return null;

  return (
    <StatStrip
      className="mb-5"
      donut={{
        segments: [
          { label: "Enabled", value: s.enabled, color: "green" },
          { label: "Disabled", value: s.disabled, color: "cyan" },
        ],
        center: s.total,
        centerSub: "toolsets",
      }}
      // Enabled and Disabled are the donut's arcs and Catalog is its centre.
      // Platforms is the footnote (T-0124).
      tiles={[
        { icon: Layers, label: "Platforms", value: HERMES_PLATFORMS.length, color: "purple" },
      ]}
      ring={{
        value: s.total > 0 ? s.enabled / s.total : 0,
        color: "green",
        label: <span className="text-body">{Math.round((s.enabled / Math.max(1, s.total)) * 100)}%</span>,
        sublabel: "enabled",
      }}
    />
  );
}
