// ═══════════════════════════════════════════════════════════════
// Session Constants — Shared role/source metadata for session views
// ═══════════════════════════════════════════════════════════════
// Single source of truth for ROLE_META (used by session detail page)
// and SOURCE_META (used by session list page).
// Previously both were duplicated inline across multiple components.

import { Bot, Calendar, Cpu, Globe, Wrench, User, Zap } from "lucide-react";
import type { SessionSource } from "@/lib/session-repository";

// ── Role Metadata (session transcript viewer) ───────────────

export const ROLE_META: Record<
  string,
  {
    icon: React.ReactNode;
    color: string;
    bg: string;
    bgSolid: string;
    text: string;
    label: string;
  }
> = {
  user: {
    icon: <User className="w-3.5 h-3.5" />,
    color: "text-neon-cyan",
    bg: "border-neon-cyan/20 bg-neon-cyan/5",
    bgSolid: "bg-neon-cyan/10",
    text: "text-neon-cyan",
    label: "USER",
  },
  assistant: {
    icon: <Bot className="w-3.5 h-3.5" />,
    color: "text-neon-purple",
    bg: "border-neon-purple/20 bg-neon-purple/5",
    bgSolid: "bg-neon-purple/10",
    text: "text-neon-purple",
    label: "ASSISTANT",
  },
  tool: {
    icon: <Wrench className="w-3.5 h-3.5" />,
    color: "text-neon-green",
    bg: "border-neon-green/20 bg-neon-green/5",
    bgSolid: "bg-neon-green/10",
    text: "text-neon-green",
    label: "TOOL",
  },
  system: {
    icon: <Cpu className="w-3.5 h-3.5" />,
    color: "text-white/50",
    bg: "border-white/10 bg-white/5",
    bgSolid: "bg-white/5",
    text: "text-white/40",
    label: "SYSTEM",
  },
};

// ── Source Metadata (session list badges) ───────────────────

export const SOURCE_META: Record<
  SessionSource,
  { label: string; colorClass: string; icon: React.ReactNode }
> = {
  cli: {
    label: "CLI",
    colorClass: "bg-neon-orange/10 text-neon-orange",
    icon: <Bot className="w-3 h-3" />,
  },
  cron: {
    label: "Cron",
    colorClass: "bg-neon-cyan/10 text-neon-cyan",
    icon: <Calendar className="w-3 h-3" />,
  },
  mission: {
    label: "Mission",
    colorClass: "bg-neon-green/10 text-neon-green",
    icon: <Zap className="w-3 h-3" />,
  },
  api: {
    label: "API",
    colorClass: "bg-neon-purple/10 text-neon-purple",
    icon: <Globe className="w-3 h-3" />,
  },
};

// ── Session title helper ────────────────────────────────────

// Re-exported from src/lib/session-title.ts for backward compatibility with
// existing imports. The new module owns the implementation; this file just
// exposes the same symbol so consumers don't need to update their imports.
//
// See references/sessions-architecture.md for the full fallback chain.
export { formatSessionTitle } from "@/lib/session-title";