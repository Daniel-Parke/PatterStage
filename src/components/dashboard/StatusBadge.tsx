// ═══════════════════════════════════════════════════════════════
// StatusBadge — status badge for missions
// ═══════════════════════════════════════════════════════════════
// Used by the dashboard's active-missions panel. The word comes from the one
// vocabulary (src/lib/status-labels.ts): this badge used to title-case the
// raw enum, so the same mission read "Successful" here and "Finished" on the
// board (T-0096, decision 13).

import {
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";

import { missionStatusLabel } from "@/lib/status-labels";

// ── Shared shape ────────────────────────────────────────────

interface StatusBadgeDef {
  bg: string;
  text: string;
  icon: React.ReactNode;
}

// ── Component ───────────────────────────────────────────────

function StatusBadge({ def, label }: { def: StatusBadgeDef; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono ${def.bg} ${def.text} flex-shrink-0`}
    >
      {def.icon} {label}
    </span>
  );
}

// ── Mission badge styles ────────────────────────────────────

const MISSION_BADGE_STYLES: Record<string, StatusBadgeDef> = {
  queued: {
    bg: "bg-neon-orange/10",
    text: "text-neon-orange",
    icon: <Clock className="w-3 h-3" />,
  },
  dispatched: {
    bg: "bg-neon-cyan/10",
    text: "text-neon-cyan",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  successful: {
    bg: "bg-neon-green/10",
    text: "text-neon-green",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  failed: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    icon: <XCircle className="w-3 h-3" />,
  },
};

// ── Public API ──────────────────────────────────────────────

export function MissionStatusBadge({
  status,
  queuedForRun,
}: {
  status: string;
  /** Whether a `queued` mission is actually in the queue (Queued) or a saved draft (Draft). */
  queuedForRun?: boolean;
}) {
  const def = MISSION_BADGE_STYLES[status] || MISSION_BADGE_STYLES.queued;
  return <StatusBadge def={def} label={missionStatusLabel({ status, queuedForRun })} />;
}
