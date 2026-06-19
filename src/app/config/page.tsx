// ═══════════════════════════════════════════════════════════════
// Config Index — Grouped Configuration Sections
// ═══════════════════════════════════════════════════════════════

"use client";

import Link from "next/link";
import { Settings, ChevronRight, Wrench, Sparkles } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { CONFIG_SECTIONS } from "@/lib/config-schema";
import { pluralise } from "@/lib/utils";
import { iconColorMap, colorBorderMap, badgeBgMap } from "@/lib/theme";
import { useConfig } from "@/hooks/useConfig";
import type { AccentColor } from "@/types/hermes";

// ── Category definitions (mirrors sidebar groups) ─────────
interface CategoryDef {
  label: string;
  description: string;
  sectionIds: string[];
}

const CATEGORIES: CategoryDef[] = [
  {
    label: "Core",
    description: "Most commonly changed settings — agent behavior, display, and memory",
    sectionIds: ["agent", "display", "memory"],
  },
  {
    label: "Infrastructure",
    description: "Terminal backends, compression, browser automation, checkpoints, and logging",
    sectionIds: ["terminal", "compression", "browser", "checkpoints", "code_execution", "logging"],
  },
  {
    label: "Security",
    description: "Guardrails, PII protection, and command approval workflows",
    sectionIds: ["security", "privacy", "approvals"],
  },
  {
    label: "Voice & Audio",
    description: "Text-to-speech, speech-to-text, and voice recording settings",
    sectionIds: ["tts", "stt", "voice"],
  },
  {
    label: "Automation",
    description: "Delegation, scheduled jobs, session lifecycle, and skill discovery",
    sectionIds: ["delegation", "cron", "session_reset", "skills"],
  },
  {
    label: "Integrations",
    description: "Platform connections, streaming, web backends, and auxiliary models",
    sectionIds: ["discord", "streaming", "web", "platform_toolsets", "smart_model_routing", "human_delay"],
  },
];

// ── CardLink Component ───────────────────────────────────────
//
// Shared shell for the SectionCard and QuickLinkCard grids on the
// config index page. Both wrap a Link with the same border +
// icon + title + description + footer layout, differing only in
// the footer badges. Centralising the shell lets each card stay
// focused on the per-section content (configured badge, complex
// key count, etc.) without re-deriving the card chrome.

interface CardLinkProps {
  href: string;
  icon: typeof Sparkles;
  title: string;
  description: string;
  color: AccentColor;
  footer?: React.ReactNode;
}

function CardLink({
  href,
  icon: Icon,
  title,
  description,
  color,
  footer,
}: CardLinkProps) {
  return (
    <Link
      href={href}
      className={`group rounded-xl border bg-dark-900/50 p-5 transition-all ${colorBorderMap[color]}`}
    >
      <div className="flex items-center justify-between mb-3">
        <Icon className={`w-5 h-5 ${iconColorMap[color]}`} />
        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
      </div>
      <h3 className="text-base font-semibold text-white mb-1">
        {title}
      </h3>
      <p className="text-xs text-white/40 leading-relaxed">
        {description}
      </p>
      {footer && <div className="mt-3 flex items-center gap-2 flex-wrap">{footer}</div>}
    </Link>
  );
}

// ── SectionCard Component ─────────────────────────────────────

function SectionCard({
  sectionId,
  config,
}: {
  sectionId: string;
  config: Record<string, unknown> | null;
}) {
  const section = CONFIG_SECTIONS[sectionId];
  if (!section) return null;

  const sectionData = config?.[section.id] as Record<string, unknown> | undefined;
  const fieldCount = section.fields.length;

  return (
    <CardLink
      href={`/config/${section.id}`}
      icon={section.icon}
      title={section.label}
      description={section.description}
      color={section.color}
      footer={
        <>
          <span className="text-[10px] font-mono text-white/25 bg-white/5 px-1.5 py-0.5 rounded">
            {fieldCount} field{pluralise(fieldCount)}
          </span>
          {sectionData && (
            <span className="text-[10px] font-mono text-neon-green/60 bg-neon-green/5 px-1.5 py-0.5 rounded">
              configured
            </span>
          )}
          {section.complexKeys && section.complexKeys.length > 0 && (
            <span className="text-[10px] font-mono text-neon-orange/60 bg-neon-orange/5 px-1.5 py-0.5 rounded">
              +{section.complexKeys.length} advanced
            </span>
          )}
        </>
      }
    />
  );
}

// ── QuickLinkCard Component ──────────────────────────────────
//
// Thin wrapper over CardLink for the "Personalities" and "Toolsets"
// callout cards under the SectionCard grid. Both point to an
// editor outside /config/[section] and just need a single badge —
// keeping the wrapper lets the call site stay declarative
// (`<QuickLinkCard ... color="purple" />`) without re-listing the
// CardLink prop bag.

interface QuickLinkCardProps {
  href: string;
  icon: typeof Sparkles;
  title: string;
  description: string;
  badge: string;
  color: AccentColor;
}

function QuickLinkCard({
  href,
  icon: Icon,
  title,
  description,
  badge,
  color,
}: QuickLinkCardProps) {
  return (
    <CardLink
      href={href}
      icon={Icon}
      title={title}
      description={description}
      color={color}
      footer={
        <span
          className={`text-[10px] font-mono ${iconColorMap[color]}/60 ${badgeBgMap[color]}/5 px-1.5 py-0.5 rounded`}
        >
          {badge}
        </span>
      }
    />
  );
}

export default function ConfigIndexPage() {
  // useConfig is the TanStack Query data layer for the parsed config.yaml.
  // On error it returns `data: null`, which the render below treats as the
  // failure branch ("Failed to load configuration.") — preserving the old
  // useApiData behaviour where any missing-data state is the failure state.
  const { data: config, isLoading: loading } = useConfig();

  return (
    <AppPageShell>
      <PageHeader
        icon={Settings}
        title="Configuration"
        subtitle={`${Object.keys(CONFIG_SECTIONS).length} sections — edit config.yaml with auto-backup`}
        color="purple"
        backHref="/"
        backLabel="HOME"
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8 flex-1 w-full">
        {!config && loading ? (
          <LoadingSpinner text="Loading configuration..." />
        ) : !config ? (
          <p className="text-xs text-white/40 font-mono">Failed to load configuration.</p>
        ) : (
          <>
            {/* Quick links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <QuickLinkCard
                href="/operations/personalities"
                icon={Sparkles}
                title="Personalities"
                description="Manage personality presets with full CRUD, live preview, and one-click activation"
                badge="dedicated editor"
                color="purple"
              />
              <QuickLinkCard
                href="/operations/tools"
                icon={Wrench}
                title="Toolsets"
                description="Toggle tool availability per platform — control which tools each channel can use"
                badge="per-platform toggle"
                color="cyan"
              />
            </div>

            {/* Grouped sections */}
            {CATEGORIES.map((cat) => (
              <div key={cat.label}>
                <div className="mb-4">
                  <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">
                    {cat.label}
                  </h2>
                  <p className="text-xs text-white/30 mt-0.5">{cat.description}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cat.sectionIds.map((sectionId) => (
                    <SectionCard key={sectionId} sectionId={sectionId} config={config} />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </AppPageShell>
  );
}
