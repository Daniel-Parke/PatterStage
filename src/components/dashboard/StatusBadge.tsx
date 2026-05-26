// ═══════════════════════════════════════════════════════════════
// StatusBadge — Unified status badges for missions & cron jobs
// ═══════════════════════════════════════════════════════════════
// Shared by the dashboard's active-missions and cron-jobs panels.
// Eliminates inline duplication of MISSION_BADGE_STYLES and
// CRON_BADGE_STYLES that previously lived in the page component.

import {
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  Pause,
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
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono ${def.bg} ${def.text} flex-shrink-0`}
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

const CRON_BADGE_STYLES: Record<string, StatusBadgeDef> = {
  running: {
    bg: "bg-neon-green/10",
    text: "text-neon-green",
    icon: <Loader2 className="w-2.5 h-2.5 animate-spin" />,
    label: "Running",
  },
  scheduled: {
    bg: "bg-neon-green/10",
    text: "text-neon-green",
    icon: <Play className="w-2.5 h-2.5" />,
    label: "Active",
  },
  queued: {
    bg: "bg-neon-orange/10",
    text: "text-neon-orange",
    icon: <Clock className="w-2.5 h-2.5" />,
    label: "Queued",
  },
  completed: {
    bg: "bg-neon-green/10",
    text: "text-neon-green",
    icon: <CheckCircle2 className="w-2.5 h-2.5" />,
    label: "Done",
  },
  failed: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    icon: <XCircle className="w-2.5 h-2.5" />,
    label: "Failed",
  },
};

// ── Public API ──────────────────────────────────────────────

import { titleCase } from "@/lib/utils";

export function MissionStatusBadge({ status }: { status: string }) {
  const def = MISSION_BADGE_STYLES[status] || MISSION_BADGE_STYLES.queued;
  return <StatusBadge def={{ ...def, label: titleCase(status) }} />;
}

export function CronStatusBadge({
  state,
  enabled,
}: {
  state: string;
  enabled: boolean;
}) {
  if (!enabled) {
    return (
      <StatusBadge
        def={{
          bg: "bg-white/5",
          text: "text-white/40",
          icon: <Pause className="w-2.5 h-2.5" />,
          label: "Paused",
        }}
      />
    );
  }
  const def =
    CRON_BADGE_STYLES[state] || {
      bg: "bg-white/5",
      text: "text-white/40",
      icon: null,
      label: titleCase(state),
    };
  return <StatusBadge def={def} />;
}