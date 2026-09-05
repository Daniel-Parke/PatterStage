// ═══════════════════════════════════════════════════════════════
// Settings — the index, derived from one section catalogue (T-0097, D79)
//
// The grid is src/lib/config-sections.ts rendered: every section once, in
// its group, so the count in the subtitle is the count on the page. Three
// cards lead to pages rather than sections (Models, Restore, System). The
// search runs over every section's label, description and fields, and says
// on the card which field matched, so "reasoning" finds the Agent section and
// tells you why.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Settings, ChevronRight, Search, Globe, RotateCcw } from "lucide-react";

import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { CONFIG_SECTIONS, type FieldDef, type SectionDef } from "@/lib/config-schema";
import { SETTINGS_GROUPS, SETTINGS_TOOLS, settingsSectionIds } from "@/lib/config-sections";
import { pluralise } from "@/lib/utils";
import { iconColorMap, colorBorderMap, badgeBgMap } from "@/lib/theme";
import { useConfig } from "@/hooks/useConfig";
import type { AccentColor } from "@/types/console";

const TOOL_ICONS = { Globe, RotateCcw, Settings } as const;

interface CardLinkProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  color: AccentColor;
  footer?: React.ReactNode;
}

function CardLink({ href, icon: Icon, title, description, color, footer }: CardLinkProps) {
  return (
    <Link href={href} className={`group rounded-xl border bg-dark-900/50 p-5 transition-all ${colorBorderMap[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <Icon className={`w-5 h-5 ${iconColorMap[color]}`} />
        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-ps-text-secondary group-hover:translate-x-1 transition-all" />
      </div>
      <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-ps-text-muted leading-relaxed">{description}</p>
      {footer && <div className="mt-3 flex items-center gap-2 flex-wrap">{footer}</div>}
    </Link>
  );
}

/** The fields of a section whose label, key or description carry the query. */
function matchingFields(section: SectionDef, q: string): FieldDef[] {
  return section.fields.filter((f) =>
    [f.label, f.key, f.description ?? ""].some((t) => t.toLowerCase().includes(q)),
  );
}

function sectionMatches(section: SectionDef, q: string): boolean {
  if (!q) return true;
  return (
    section.label.toLowerCase().includes(q) ||
    section.id.toLowerCase().includes(q) ||
    section.description.toLowerCase().includes(q) ||
    matchingFields(section, q).length > 0
  );
}

function SectionCard({ section, config, q }: { section: SectionDef; config: Record<string, unknown> | null; q: string }) {
  const sectionData = config?.[section.id] as Record<string, unknown> | undefined;
  const fieldCount = section.fields.length;
  const hits = q ? matchingFields(section, q) : [];

  return (
    <CardLink
      href={`/agent/settings/${section.id}`}
      icon={section.icon}
      title={section.label}
      description={section.description}
      color={section.color}
      footer={
        <>
          {fieldCount > 0 && (
            <span className="text-xs font-mono text-ps-text-faint bg-white/5 px-1.5 py-0.5 rounded">
              {fieldCount} field{pluralise(fieldCount)}
            </span>
          )}
          {section.type === "file" && (
            <span className="text-xs font-mono text-ps-text-faint bg-white/5 px-1.5 py-0.5 rounded">file</span>
          )}
          {sectionData && (
            <span className="text-xs font-mono text-neon-green/70 bg-neon-green/5 px-1.5 py-0.5 rounded">configured</span>
          )}
          {section.complexKeys && section.complexKeys.length > 0 && (
            <span className="text-xs font-mono text-neon-orange/90 bg-neon-orange/5 px-1.5 py-0.5 rounded">
              +{section.complexKeys.length} advanced
            </span>
          )}
          {hits.slice(0, 3).map((f) => (
            <span key={f.key} className="text-xs font-mono text-neon-cyan bg-neon-cyan/10 px-1.5 py-0.5 rounded">
              {f.label}
            </span>
          ))}
        </>
      }
    />
  );
}

export default function SettingsIndexPage() {
  const { data: config, isLoading: loading, error, refetch } = useConfig();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const sectionCount = settingsSectionIds().length;

  const groups = useMemo(
    () =>
      SETTINGS_GROUPS.map((g) => ({
        ...g,
        sections: g.sectionIds
          .map((id) => CONFIG_SECTIONS[id])
          .filter((s): s is SectionDef => Boolean(s) && sectionMatches(s, q)),
      })).filter((g) => g.sections.length > 0),
    [q],
  );
  const tools = SETTINGS_TOOLS.filter((t) => !q || t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
  const nothing = groups.length === 0 && tools.length === 0;

  return (
    <AppPageShell>
      <PageHeader
        icon={Settings}
        subtitle={`${sectionCount} sections of config.yaml, edited with a backup each time, plus Models, Restore and System`}
        color="orange"
        backHref="/"
        backLabel="HOME"
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8 flex-1 w-full">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ps-text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search settings"
            placeholder="Find a setting by name, e.g. reasoning, timeout, voice…"
            className="w-full bg-dark-900/50 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-neon-orange/50 transition-colors font-mono"
          />
        </div>

        {error && <LoadErrorBanner error={error} onRetry={() => void refetch()} hint="The cards still open; the 'configured' badges need the file to read." />}
        {loading && !config && <LoadingSpinner text="Reading config.yaml…" />}

        {tools.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {tools.map((t) => (
              <CardLink
                key={t.href}
                href={t.href}
                icon={TOOL_ICONS[t.icon as keyof typeof TOOL_ICONS] ?? Settings}
                title={t.label}
                description={t.description}
                color={t.color}
                footer={
                  <span className={`text-xs font-mono ${iconColorMap[t.color]} ${badgeBgMap[t.color]} px-1.5 py-0.5 rounded`}>page</span>
                }
              />
            ))}
          </div>
        )}

        {groups.map((group) => (
          <div key={group.label}>
            <div className="mb-4">
              <h2 className="text-sm font-bold text-ps-text-secondary uppercase tracking-wider">{group.label}</h2>
              <p className="text-xs text-ps-text-muted mt-0.5">{group.description}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.sections.map((section) => (
                <SectionCard key={section.id} section={section} config={config ?? null} q={q} />
              ))}
            </div>
          </div>
        ))}

        {nothing && (
          <p className="text-sm text-ps-text-muted font-mono">
            No setting matches &ldquo;{query.trim()}&rdquo;. Try a word from the field&apos;s name, or clear the search.
          </p>
        )}
      </div>
    </AppPageShell>
  );
}
