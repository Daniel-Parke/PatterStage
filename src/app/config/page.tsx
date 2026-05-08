// ═══════════════════════════════════════════════════════════════
// Config Index — Grouped Configuration Sections
// ═══════════════════════════════════════════════════════════════

"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Settings,
  Cpu,
  Globe,
  Activity,
  Layers,
  Terminal,
  Shield,
  Volume2,
  Mic,
  GitBranch,
  ListTodo,
  ChevronRight,
  HardDrive,
  Zap,
  RotateCcw,
  FileText,
  ShieldCheck,
  Wrench,
  Sparkles,
  ScrollText,
  MessageSquare,
  Clock,
  Lock,
  Code,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { CONFIG_SECTIONS } from "@/lib/config-schema";
import { iconColorMap, colorBorderMap } from "@/lib/theme";

// Map icon names to components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Cpu, Globe, Activity, Layers, Terminal, Shield,
  Volume2, Mic, GitBranch, ListTodo, HardDrive, Zap,
  RotateCcw, FileText, ShieldCheck, Settings, Wrench, Sparkles,
  ScrollText, MessageSquare, Clock, Lock, Code,
};

// ── Category definitions (mirrors sidebar groups) ─────────
interface CategoryDef {
  label: string;
  description: string;
  sectionIds: string[];
}

const CATEGORIES: CategoryDef[] = [
  {
    label: "Core",
    description: "Most commonly changed settings — agent behavior, model, display, and memory",
    sectionIds: ["agent", "model", "display", "memory"],
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
    sectionIds: ["discord", "streaming", "web", "auxiliary", "platform_toolsets", "smart_model_routing", "human_delay"],
  },
];

export default function ConfigIndexPage() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((d) => setConfig(d.data))
      .catch(() => setConfig(null));
  }, []);

  const renderSectionCard = (sectionId: string) => {
    const section = CONFIG_SECTIONS[sectionId];
    if (!section) return null;

    const Icon = iconMap[section.icon] || Settings;
    const sectionData = config?.[section.id] as Record<string, unknown> | undefined;
    const fieldCount = section.fields.length;

    return (
      <Link
        key={section.id}
        href={`/config/${section.id}`}
        className={`group rounded-xl border bg-dark-900/50 p-5 transition-all ${colorBorderMap[section.color]}`}
      >
        <div className="flex items-center justify-between mb-3">
          <Icon className={`w-5 h-5 ${iconColorMap[section.color]}`} />
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
  };

  return (
    <div className="min-h-screen bg-dark-950 grid-bg">
      {/* Header */}
      <div className="border-b border-white/10 bg-dark-900/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-neon-purple" />
          <div>
            <h1 className="text-lg font-bold text-white">Configuration</h1>
            <p className="text-xs text-white/40 font-mono">
              {Object.keys(CONFIG_SECTIONS).length} sections — edit config.yaml with auto-backup
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        {!config ? (
          <LoadingSpinner text="Loading configuration..." />
        ) : (
          <>
            {/* Quick links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                href="/personalities"
                className="group rounded-xl border bg-dark-900/50 p-5 transition-all border-purple-500/20 hover:border-purple-500/50"
              >
                <div className="flex items-center justify-between mb-3">
                  <Sparkles className="w-5 h-5 text-neon-purple" />
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">
                  Personalities
                </h3>
                <p className="text-xs text-white/40 leading-relaxed">
                  Manage personality presets with full CRUD, live preview, and one-click activation
                </p>
                <div className="mt-3">
                  <span className="text-[10px] font-mono text-neon-purple/60 bg-neon-purple/5 px-1.5 py-0.5 rounded">
                    dedicated editor
                  </span>
                </div>
              </Link>
              <Link
                href="/agent/tools"
                className="group rounded-xl border bg-dark-900/50 p-5 transition-all border-cyan-500/20 hover:border-cyan-500/50"
              >
                <div className="flex items-center justify-between mb-3">
                  <Wrench className="w-5 h-5 text-neon-cyan" />
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">
                  Toolsets
                </h3>
                <p className="text-xs text-white/40 leading-relaxed">
                  Toggle tool availability per platform — control which tools each channel can use
                </p>
                <div className="mt-3">
                  <span className="text-[10px] font-mono text-neon-cyan/60 bg-neon-cyan/5 px-1.5 py-0.5 rounded">
                    per-platform toggle
                  </span>
                </div>
              </Link>
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
                  {cat.sectionIds.map(renderSectionCard)}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
