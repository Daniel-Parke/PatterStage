// ═══════════════════════════════════════════════════════════════
// AgentRuntimeDefaultsCard — Agent profile, scope, timeout, model, skills
// Extracted from missions/page.tsx for modularity.
// ═══════════════════════════════════════════════════════════════

"use client";

import ProfileSelector from "@/components/ui/ProfileSelector";
import MissionTimeSelector from "@/components/ui/MissionTimeSelector";
import TimeoutSelector from "@/components/ui/TimeoutSelector";
import ModelPicker from "@/components/missions/ModelPicker";
import SkillSelector from "@/components/ui/SkillSelector";

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
  /** Skills attached to this mission — rendered inside the card */
  skills?: string[];
  onSkillsChange?: (skills: string[]) => void;
  variant?: "card" | "embedded";
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
  skills,
  onSkillsChange,
  variant = "card",
}: AgentRuntimeDefaultsCardProps) {
  const embedded = variant === "embedded";
  const showSkills =
    typeof skills !== "undefined" && onSkillsChange && !embedded;

  return (
    <div
      className={
        embedded
          ? "space-y-4"
          : "rounded-xl border border-white/10 bg-dark-800/30 p-3 sm:p-4 space-y-4"
      }
    >
      {!embedded && (
        <div className="space-y-1">
          <h3 className="text-xs font-mono text-ps-text-muted uppercase tracking-wider">
            Agent & runtime defaults
          </h3>
          <p className="text-xs text-ps-text-faint font-mono leading-relaxed">
            These fields feed the mission prompt and dispatch configuration.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs text-ps-text-muted font-mono block mb-1.5">
            Model
          </label>
          <ModelPicker
            id={modelPickerId}
            modelId={modelId}
            provider={provider}
            onChange={onModelChange}
            helperPlacement="tooltip"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-ps-text-muted font-mono block mb-1.5">
            Agent profile
          </label>
          <ProfileSelector
            value={profileId}
            onChange={onProfileChange}
            subtitle="tooltip"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
        <div className="flex flex-col gap-1.5 min-h-[3.25rem]">
          <label className="text-xs text-ps-text-muted font-mono block mb-1.5">
            Mission scope
          </label>
          <div className="flex-1 flex flex-col justify-center">
            <MissionTimeSelector
              value={missionTimeMinutes}
              onChange={onMissionTimeChange}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 min-h-[3.25rem]">
          <label className="text-xs text-ps-text-muted font-mono block mb-1.5">
            {timeoutHeading}{" "}
            <span className="text-ps-text-faint font-normal normal-case">
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

      {showSkills && (
        <div className="space-y-1.5">
          <label className="text-xs text-ps-text-muted font-mono block mb-1.5">
            Attached Skills{" "}
            <span className="text-ps-text-faint">(optional, max 10)</span>
          </label>
          <SkillSelector
            value={skills}
            onChange={onSkillsChange}
            profileId={profileId}
            max={10}
          />
        </div>
      )}

      {embedded && (
        <p className="text-xs text-ps-text-faint font-mono leading-relaxed">
          Profile defines agent role via SOUL/AGENTS under your Hermes home.
        </p>
      )}
    </div>
  );
}
