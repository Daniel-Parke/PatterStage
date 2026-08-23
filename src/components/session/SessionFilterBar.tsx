// ═══════════════════════════════════════════════════════════════
// SessionFilterBar — search, source filter and the view-options row
//
// Extracted verbatim from app/(main)/sessions/page.tsx. Every piece of
// state stays on the page; this component only renders the controls and
// calls back. Presentation only.
// ═══════════════════════════════════════════════════════════════

"use client";

import { Activity, EyeOff, Filter, Layers } from "lucide-react";
import { SearchInput } from "@/components/ui/Input";
import { LiveDot } from "@/components/ui/LiveDot";
import { SOURCE_META } from "@/components/session/constants";
import type { SessionSource } from "@/lib/sessions/session-repository";

export interface SessionFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sources: SessionSource[];
  sourceFilter: SessionSource | null;
  onClearSourceFilter: () => void;
  onSelectSourceFilter: (src: SessionSource) => void;
  groupByMission: boolean;
  onToggleGroupByMission: () => void;
  hideApiNoise: boolean;
  onToggleHideApiNoise: () => void;
}

export default function SessionFilterBar({
  search,
  onSearchChange,
  sources,
  sourceFilter,
  onClearSourceFilter,
  onSelectSourceFilter,
  groupByMission,
  onToggleGroupByMission,
  hideApiNoise,
  onToggleHideApiNoise,
}: SessionFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 mb-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Search sessions by title, ID, profile, or mission id..."
            accentColor="orange"
          />
        </div>
        {sources.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-ps-text-muted flex-shrink-0" />
            <button
              onClick={onClearSourceFilter}
              aria-pressed={!sourceFilter}
              className={`text-xs font-mono px-2 py-1 rounded transition-colors ${
                !sourceFilter
                  ? "bg-neon-orange/20 text-neon-orange"
                  : "text-ps-text-muted hover:text-ps-text-secondary"
              }`}
            >
              All
            </button>
            {sources.map((src) => (
              <button
                key={src}
                onClick={() => onSelectSourceFilter(src)}
                aria-pressed={sourceFilter === src}
                className={`text-xs font-mono px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                  sourceFilter === src
                    ? "bg-neon-orange/20 text-neon-orange"
                    : "text-ps-text-muted hover:text-ps-text-secondary"
                }`}
              >
                {SOURCE_META[src]?.icon}
                {SOURCE_META[src]?.label ?? src}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* View options row: group-by-mission, hide-api-noise, live indicator hint */}
      <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
        <button
          type="button"
          onClick={onToggleGroupByMission}
          aria-pressed={groupByMission}
          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
            groupByMission
              ? "bg-neon-green/10 text-neon-green"
              : "text-ps-text-muted hover:text-ps-text-secondary"
          }`}
          title="Collapse sessions with the same missionId into a single card"
        >
          <Layers className="w-3 h-3" />
          Group by mission
        </button>
        <button
          type="button"
          onClick={onToggleHideApiNoise}
          aria-pressed={hideApiNoise}
          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
            hideApiNoise
              ? "bg-neon-purple/10 text-neon-purple"
              : "text-ps-text-muted hover:text-ps-text-secondary"
          }`}
          title="Hide short-lived api-source sessions (< 1KB, < 1 min) that dominate the list during stress testing"
        >
          <EyeOff className="w-3 h-3" />
          Hide API noise
        </button>
        <span
          className="flex items-center gap-1 text-ps-text-faint px-2 py-1"
          title="Active sessions get a pulsing dot and live elapsed time"
        >
          <Activity className="w-3 h-3" />
          <LiveDot /> = live
        </span>
      </div>
    </div>
  );
}
