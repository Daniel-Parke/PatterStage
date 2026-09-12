// ═══════════════════════════════════════════════════════════════
// Session Constants — Shared role/source metadata for session views
// ═══════════════════════════════════════════════════════════════
// Single source of truth for ROLE_META (used by session detail page)
// and SOURCE_META (used by session list page).
// Previously both were duplicated inline across multiple components.

import { Bot, Calendar, Cpu, Globe, HelpCircle, MessageSquare, Split, Terminal, Wrench, User, Zap } from "lucide-react";
import type { KnownSessionSource } from "@/lib/sessions/session-repository";

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
    color: "text-ps-text-muted",
    bg: "border-ps-edge-hairline bg-ps-surface-raised",
    bgSolid: "bg-ps-surface-raised",
    text: "text-ps-text-muted",
    label: "SYSTEM",
  },
};

// ── Source Metadata (session list badges) ───────────────────

export interface SourceMeta {
  label: string;
  colorClass: string;
  icon: React.ReactNode;
}

const SOURCE_META: Record<KnownSessionSource, SourceMeta> = {
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
  chat: {
    label: "Chat",
    colorClass: "bg-neon-cyan/10 text-neon-cyan",
    icon: <MessageSquare className="w-3 h-3" />,
  },
  subagent: {
    label: "Subagent",
    colorClass: "bg-neon-pink/10 text-neon-pink",
    icon: <Split className="w-3 h-3" />,
  },
  tui: {
    label: "TUI",
    colorClass: "bg-ps-surface-raised text-ps-text-secondary",
    icon: <Terminal className="w-3 h-3" />,
  },
};

/**
 * The badge for a source, which never invents one.
 *
 * The column is free text, and the old `SOURCE_META[source] ?? SOURCE_META.cli`
 * fallback badged every unrecognised value "CLI": a subagent session read as a
 * CLI session and could not be filtered for at all (T-0105, D29). An unknown
 * source prints itself.
 */
export function sourceMeta(source: string): SourceMeta {
  const known = (SOURCE_META as Record<string, SourceMeta | undefined>)[source];
  if (known) return known;
  return {
    label: source,
    colorClass: "bg-ps-surface-raised text-ps-text-muted",
    icon: <HelpCircle className="w-3 h-3" />,
  };
}

// ── Session title helper ────────────────────────────────────
//
// `formatSessionTitle` lives in src/lib/session-title.ts and is
// imported directly by consumers. This file used to re-export it
// for backward compatibility, but every consumer has been migrated
// to import from the canonical location.

/**
 * Normalize a session message's `role` field for filtering / counting.
 *
 * The state.db sync stores some messages with a missing or empty `role`
 * (notably tool messages with no role prefix in legacy files), so callers
 * need a defensive default. Returning a lower-cased string means downstream
 * comparisons can use plain `===` against the lowercase keys in ROLE_META.
 *
 * Used by the session detail page's role counts, the role filter, and the
 * "scroll to next role" jump. Single source of truth so the "unknown"
 * default doesn't drift between the three callsites.
 */
export function getMessageRole(msg: { role?: string | null }): string {
  return (msg.role || "unknown").toLowerCase();
}