// ═══════════════════════════════════════════════════════════════
// AgentRuntimeDefaultsCard — Agent profile, scope, timeout, model
// Extracted from missions/page.tsx for modularity.
// ═══════════════════════════════════════════════════════════════

"use client";

import ProfileSelector from "@/components/ui/ProfileSelector";
import MissionTimeSelector from "@/components/ui/MissionTimeSelector";
import TimeoutSelector from "@/components/ui/TimeoutSelector";
import ModelPicker from "@/components/missions/ModelPicker";

export interface AgentRuntimeDefaultsCardProps {
  profileId: string;
  onProfileChange: (id: string) => void;
  missionTimeMinutes: number;
  onMissionTimeChange: (v: number) => void;
  timeoutMinutes: number;
  onTimeoutChange: (v: number) => void;
  modelId: string;
  provider: string;
  onModelChange: (mid: string, prov: string) => void;
  modelPickerId?: string;
  timeoutHeading: string;
}

export default function AgentRuntimeDefaultsCard({
  profileId,
  onProfileChange,
  missionTimeMinutes,
  onMissionTimeChange,
  timeoutMinutes,
  onTimeoutChange,
  modelId,
  provider,
  onModelChange,
  modelPickerId,
  timeoutHeading,
}: AgentRuntimeDefaultsCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-dark-800/30 p-3 sm:p-4 space-y-4">
      <div className="space-y-1">
        <h3 className="text-[11px] font-mono text-white/50 uppercase tracking-wider">
          {"Agent & runtime defaults"}
        </h3>
        <p className="text-[10px] text-white/25 font-mono leading-relaxed">
          These fields feed the mission prompt and dispatch configuration.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-white/40 font-mono block">Agent profile</label>
        <ProfileSelector
          value={profileId}
          onChange={onProfileChange}
          subtitle="tooltip"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
        <div className="flex flex-col gap-1.5 min-h-[3.25rem]">
          <label className="text-xs text-white/40 font-mono block">Mission scope</label>
          <div className="flex-1 flex flex-col justify-center">
            <MissionTimeSelector
              value={missionTimeMinutes}
              onChange={onMissionTimeChange}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 min-h-[3.25rem]">
          <label className="text-xs text-white/40 font-mono block">
            {timeoutHeading}{" "}
            <span className="text-white/25 font-normal normal-case">
              — Inactivity kill switch
            </span>
          </label>
          <div className="flex-1 flex flex-col justify-center">
            <TimeoutSelector
              value={timeoutMinutes}
              onChange={onTimeoutChange}
              showSubtitle={false}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-white/40 font-mono block">Model</label>
        <ModelPicker
          id={modelPickerId}
          modelId={modelId}
          provider={provider}
          onChange={onModelChange}
          helperPlacement="tooltip"
        />
      </div>
    </div>
  );
}