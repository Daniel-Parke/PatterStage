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
import { iconColorMap, colorBorderMap, badgeBgMap } from "@/lib/theme";
import { useApiData } from "@/hooks/useApiData";
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
  const iconClass = `w-5 h-5 ${iconColorMap[section.color]}`;

  return (
    <Link
      href={`/config/${section.id}`}
      className={`group rounded-xl border bg-dark-900/50 p-5 transition-all ${colorBorderMap[section.color]}`}
    >
      <div className="flex items-center justify-between mb-3">
        <section.icon className={iconClass} />
        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
      </div>
      <h3 className="text-base font-semibold text-white mb-1">
        {section.label}
      </h3>
      <p className="text-xs text-white/40 leading-relaxed">
        {section.description}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] font-mono text-white/25 bg-white/5 px-1.5 py-0.5 rounded">
          {fieldCount} field{fieldCount !== 1 ? "s" : ""}
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
      </div>
    </Link>
  );
}

// ── QuickLinkCard Component ──────────────────────────────────
//
// Shared shape for the "Personalities" and "Toolsets" callout cards
// under the SectionCard grid. Both are simple Link cards pointing to
// an editor outside /config/[section]. DRY'd here so the two cards
// stay in lockstep on hover/iconography styling.

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
      <div className="mt-3">
        <span
          className={`text-[10px] font-mono ${iconColorMap[color]}/60 ${badgeBgMap[color]}/5 px-1.5 py-0.5 rounded`}
        >
          {badge}
        </span>
      </div>
    </Link>
  );
}

export default function ConfigIndexPage() {
  // useApiData absorbs the loadConfig + useEffect + AbortController trio
  // and tracks loading/error in one place. The previous catch block
  // silently swallowed errors and set config=null; the hook surfaces
  // the error via the `error` return, but the rendered fallback
  // ("Failed to load configuration.") is preserved by treating any
  // missing data state — error or `data === null` — as the failure
  // branch. The `data ?? null` line preserves the old `json.data ?? null`
  // fallback for the (unreachable in practice) "no data key" case.
  const { data, loading } = useApiData<Record<string, unknown> | null>("/api/config");
  const config = data ?? null;

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
