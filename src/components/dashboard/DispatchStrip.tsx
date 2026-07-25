// ═══════════════════════════════════════════════════════════════
// DispatchStrip — dashboard "Mission Dispatch" quick-launch panel
// ═══════════════════════════════════════════════════════════════
//
// Extracted from the dashboard god-page (src/app/page.tsx). Owns its
// own collapsed/expanded state, the template grouping/cap memos, and
// the router push, so the page just hands it `templates` + `categories`.
//
// Collapsed: a horizontal strip of the top-N templates (+ "more").
// Expanded: every template grouped by category in accordions.

"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Rocket, ChevronRight, ChevronDown } from "lucide-react";

import CategoryAccordion from "@/components/ui/CategoryAccordion";
import TemplatePill from "@/components/ui/TemplatePill";
import {
  groupTemplatesByCategory,
  type TemplateLike,
} from "@/lib/mission-categories";
import type { MissionCategory } from "@/lib/mission-category-repository";
import type { DashboardTemplate } from "@/lib/dashboard-initial-load";
import { composeTemplateUrl } from "@/lib/dashboard-helpers";
import { topNTemplates } from "@/lib/dashboard-top-templates";
import type { AccentColor } from "@/types/console";

export interface DispatchStripProps {
  templates: DashboardTemplate[];
  categories: MissionCategory[];
}

export default function DispatchStrip({ templates, categories }: DispatchStripProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const open = useCallback(() => setExpanded(true), []);
  const toggle = useCallback(() => setExpanded((v) => !v), []);

  // Group templates by category for the expanded view.
  const templateGroups = useMemo(
    () => groupTemplatesByCategory(templates as TemplateLike[], categories),
    [templates, categories],
  );
  // Cap the collapsed strip to 12 entries (custom-first / alphabetical).
  const collapsedStrip = useMemo(() => topNTemplates(templates), [templates]);

  const select = useCallback(
    (id: string) => router.push(composeTemplateUrl(id)),
    [router],
  );

  return (
    <div className="rounded-xl border border-neon-cyan/20 bg-dark-900/50 overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-neon-cyan" />
          <span className="text-sm font-mono text-white/80">Launch a Mission</span>
          <span
            className="text-[10px] font-mono text-white/25"
            title="Mission templates you can launch from here — not a count of active missions"
          >
            · {templates.length} templates
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/orchestration/missions"
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] font-mono text-neon-cyan hover:underline flex items-center gap-1"
          >
            full control <ChevronRight className="w-3 h-3" />
          </Link>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-white/20" />
          ) : (
            <ChevronRight className="w-4 h-4 text-white/20" />
          )}
        </div>
      </button>

      {/* Collapsed: horizontal pill strip */}
      {!expanded && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {collapsedStrip.map((t) => (
            <TemplatePill key={t.id} t={t} onSelect={() => select(t.id)} />
          ))}
          {templates.length > 12 && (
            <button
              onClick={open}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-mono text-white/30 hover:text-neon-cyan transition-colors"
            >
              +{templates.length - 12} more
            </button>
          )}
        </div>
      )}

      {/* Expanded: grouped by category, all compact pills */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {templateGroups.map((group) => (
            <CategoryAccordion
              key={group.categoryId ?? "__none__"}
              name={group.label}
              count={group.items.length}
              color={group.color as AccentColor}
              expandable={group.items.length > 6}
              defaultOpen={true}
            >
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((t) => (
                  <TemplatePill key={t.id} t={t} onSelect={() => select(t.id)} />
                ))}
              </div>
            </CategoryAccordion>
          ))}
        </div>
      )}
    </div>
  );
}
