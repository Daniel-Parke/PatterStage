// ═══════════════════════════════════════════════════════════════
// Logs Constants — Shared log viewer constants
// ═══════════════════════════════════════════════════════════════

import type { LogFileGroup } from "@/lib/fs/log-files";

// ── Level text class lookup (const map, faster than switch) ──
export const LEVEL_TEXT_CLASS: Record<string, string> = {
  error: "text-red-400",
  warn: "text-neon-orange",
  debug: "text-ps-text-muted",
  info: "text-ps-text-secondary",
  unknown: "text-ps-text-muted",
};

export const GROUP_ORDER: LogFileGroup[] = ["core", "system", "other"];

export const GROUP_LABELS: Record<LogFileGroup, string> = {
  core: "Core",
  system: "System",
  other: "Other",
};
