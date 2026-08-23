// ═══════════════════════════════════════════════════════════════
// StatusBadge — status badge for missions
// ═══════════════════════════════════════════════════════════════
// Used by the dashboard's active-missions panel.

import {
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";

// ── Shared shape ────────────────────────────────────────────

interface StatusBadgeDef {
  bg: string;
  text: string;
  icon: React.ReactNode;
  label: string;
}

// ── Component ───────────────────────────────────────────────

function StatusBadge({ def }: { def: StatusBadgeDef }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono ${def.bg} ${def.text} flex-shrink-0`}
    >
      {def.icon} {def.label}
    </span>
  );
}

// ── Mission badge styles ────────────────────────────────────

const MISSION_BADGE_STYLES: Record<string, StatusBadgeDef> = {
  queued: {
    bg: "bg-neon-orange/10",
    text: "text-neon-orange",
    icon: <Clock className="w-3 h-3" />,
    label: "Queued",
  },
  dispatched: {
    bg: "bg-neon-cyan/10",
    text: "text-neon-cyan",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    label: "Dispatched",
  },
  successful: {
    bg: "bg-neon-green/10",
    text: "text-neon-green",
    icon: <CheckCircle2 className="w-3 h-3" />,
    label: "Successful",
  },
  failed: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    icon: <XCircle className="w-3 h-3" />,
    label: "Failed",
  },
};

// ── Public API ──────────────────────────────────────────────

import { titleCase } from "@/lib/utils";

export function MissionStatusBadge({ status }: { status: string }) {
  const def = MISSION_BADGE_STYLES[status] || MISSION_BADGE_STYLES.queued;
  return <StatusBadge def={{ ...def, label: titleCase(status) }} />;
}