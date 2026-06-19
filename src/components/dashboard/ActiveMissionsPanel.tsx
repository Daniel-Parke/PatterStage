// ═══════════════════════════════════════════════════════════════
// ActiveMissionsPanel — dashboard list of in-flight missions
// ═══════════════════════════════════════════════════════════════
//
// Extracted from the dashboard god-page (src/app/page.tsx). Renders
// the active (queued/dispatched) missions with a two-step-confirm
// Cancel button. The page owns the missions data + the confirm state;
// this component is presentational and renders nothing when empty.

"use client";

import Link from "next/link";
import { Rocket, ChevronRight } from "lucide-react";

import { StatusDot } from "@/components/ui/Card";
import { Panel, PanelHeader } from "@/components/dashboard/Panel";
import { MissionStatusBadge } from "@/components/dashboard/StatusBadge";
import { timeAgo } from "@/lib/utils";
import type { MissionBrief } from "@/types/hermes";

export interface ActiveMissionsPanelProps {
  /** The active (queued/dispatched) missions to list. */
  missions: MissionBrief[];
  /** Cancel handler — arms on first call, cancels on confirm. */
  onCancel: (missionId: string, missionName: string) => void;
  /** Whether the given mission's Cancel button is armed ("Confirm?"). */
  isArmedFor: (missionId: string) => boolean;
}

export default function ActiveMissionsPanel({
  missions,
  onCancel,
  isArmedFor,
}: ActiveMissionsPanelProps) {
  if (missions.length === 0) return null;

  return (
    <Panel accent="cyan">
      <PanelHeader
        icon={Rocket}
        label="Active Missions"
        accent="cyan"
        count={`(${missions.length})`}
        rightSlot={
          <Link href="/orchestration/missions" className="text-[10px] font-mono text-neon-cyan hover:underline flex items-center gap-1">
            all missions <ChevronRight className="w-3 h-3" />
          </Link>
        }
      />
      <div className="divide-y divide-white/5">
        {missions.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <StatusDot
                status={m.status === "dispatched" ? "online" : "warning"}
                pulse={m.status === "dispatched"}
              />
              <Link href="/orchestration/missions" className="text-xs text-white/80 truncate hover:text-neon-cyan transition-colors">{m.name}</Link>
              <span className="text-[10px] font-mono text-white/30 capitalize">{m.dispatchMode}</span>
              {m.latestSession ? (
                <Link
                  href={`/sessions/${m.latestSession.id}`}
                  className="text-[10px] font-mono text-white/25 hover:text-neon-cyan transition-colors"
                  title="View session"
                >
                  {m.latestSession.id.slice(-20)}
                </Link>
              ) : m.status === "dispatched" ? (
                <span className="text-[10px] font-mono text-white/15 italic">
                  Session loading...
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <MissionStatusBadge status={m.status} />
              <span className="text-[10px] font-mono text-white/25">{timeAgo(m.createdAt)}</span>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(m.id, m.name); }}
                className={`text-[10px] font-mono transition-colors px-1.5 py-0.5 rounded ${
                  isArmedFor(m.id)
                    ? "bg-red-500/20 text-red-400"
                    : "text-white/20 hover:text-red-400 hover:bg-red-500/10"
                }`}
                title="Cancel mission"
              >
                {isArmedFor(m.id) ? "Confirm?" : "Cancel"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
