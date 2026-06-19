// ── SkillCard — a single skill tile (toggle + view + edit + preview) ──────────
// Extracted verbatim from app/operations/skills/page.tsx.

import { ToggleRight, ToggleLeft, X, ChevronDown, Edit3 } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import type { Skill } from "@/types/hermes";

export interface SkillCardProps {
  skill: Skill;
  enabled: boolean;
  isExpanded: boolean;
  isPending: boolean;
  onToggle: () => void;
  onView: () => void;
  onEdit: () => void;
  expandedContent?: string;
}

export function SkillCard({
  skill,
  enabled,
  isExpanded,
  isPending,
  onToggle,
  onView,
  onEdit,
  expandedContent,
}: SkillCardProps) {
  return (
    <Card
      className={`relative overflow-hidden transition-all border-white/10 ${
        isPending ? "ring-1 ring-neon-green/30" : ""
      }`}
      glow={enabled ? "green" : undefined}
      padding="none"
    >
      {/* Left accent bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl ${
          enabled ? "bg-neon-green" : "bg-white/20"
        }`}
      />

      <div className="p-3 pl-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-mono font-semibold text-white/80 truncate">
                {skill.name}
              </span>
              {isPending && (
                <Badge color="green" size="sm">
                  Updating...
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-white/30 font-mono mt-0.5">
              {skill.category}
            </p>
          </div>

          {/* Toggle */}
          <button
            onClick={onToggle}
            disabled={isPending}
            className="flex-shrink-0 mt-0.5 disabled:opacity-40"
            title={enabled ? "Disable skill" : "Enable skill"}
          >
            {enabled ? (
              <ToggleRight className="w-7 h-7 text-neon-green" />
            ) : (
              <ToggleLeft className="w-7 h-7 text-white/20" />
            )}
          </button>
        </div>

        {/* Description */}
        <p
          className="text-xs text-white/40 leading-relaxed line-clamp-2 mb-3"
          title={skill.description}
        >
          {skill.description}
        </p>

        {/* Footer row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {enabled ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-neon-green/70">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-white/30">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                Inactive
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-white/10 text-white/30 hover:border-neon-green/30 hover:text-neon-green transition-all"
          >
            <Edit3 className="w-3 h-3" /> Edit
          </button>
          <button
            type="button"
            onClick={onView}
            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-all ${
              isExpanded
                ? "border-white/20 text-white/50 bg-white/5"
                : "border-white/10 text-white/30 hover:border-white/20 hover:text-white/60"
            }`}
          >
            {isExpanded ? (
              <>
                <X className="w-3 h-3" /> Hide
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" /> View
              </>
            )}
          </button>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <pre className="text-[11px] text-white/50 font-mono whitespace-pre-wrap max-h-48 overflow-auto leading-relaxed">
              {expandedContent ?? "// Loading..."}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}
