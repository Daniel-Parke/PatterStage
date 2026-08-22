// ═══════════════════════════════════════════════════════════════
// Logs Constants — Shared log viewer constants
// ═══════════════════════════════════════════════════════════════

import type { LogFileGroup } from "@/lib/fs/log-files";

// ── Level text class lookup (const map, faster than switch) ──
export const LEVEL_TEXT_CLASS: Record<string, string> = {
  error: "text-red-400",
  warn: "text-neon-orange",
  debug: "text-white/30",
  info: "text-white/60",
  unknown: "text-white/45",
};

export const GROUP_ORDER: LogFileGroup[] = ["core", "system", "other"];

export const GROUP_LABELS: Record<LogFileGroup, string> = {
  core: "Core",
  system: "System",
  other: "Other",
};
