// ═══════════════════════════════════════════════════════════════
// AgentRuntimeDefaultsCard — Agent profile, scope, timeout, model, skills
//
// The four pickers here were four Selectors, each with its own menu and its
// own click-outside effect and none of them a listbox. They are the one
// Picker now (T-0125); the two preset lists live here, because this card is
// the only thing that offers them.
// ═══════════════════════════════════════════════════════════════

"use client";

import { Clock, Timer } from "lucide-react";

import { sectionHeadingClasses } from "@/lib/ui/theme";
import Card from "@/components/ui/Card";
import Picker from "@/components/ui/Picker";
import ProfilePicker from "@/components/ui/ProfilePicker";
import ModelPicker from "@/components/missions/ModelPicker";
import SkillsPicker from "@/components/missions/SkillsPicker";

/** How long a mission may run, with the developer-hours it stands in for. */
const MISSION_TIME_PRESETS = [
  { minutes: 10, label: "Quick Pass", devHours: "2-3h" },
  { minutes: 15, label: "Half Day", devHours: "4h" },
  { minutes: 20, label: "Most of a Day", devHours: "5-6h" },
  { minutes: 30, label: "Full Day", devHours: "8h" },
  { minutes: 45, label: "Deep Dive", devHours: "12h" },
  { minutes: 60, label: "Sprint", devHours: "16h" },
];

/** The inactivity kill switch. 0 is unlimited. */
const TIMEOUT_PRESETS = [
  { minutes: 5, label: "5m" },
  { minutes: 10, label: "10m (recommended)" },
  { minutes: 15, label: "15m" },
  { minutes: 20, label: "20m" },
  { minutes: 30, label: "30m" },
  { minutes: 60, label: "60m" },
  { minutes: 0, label: "∞ (unlimited)" },
];

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

const LABEL = "text-micro text-ps-text-muted font-mono block mb-1.5";

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

  // A value outside the presets is shown as its own minutes rather than
  // silently snapped to the recommended one.
  const missionTimeOptions = MISSION_TIME_PRESETS.some((p) => p.minutes === missionTimeMinutes)
    ? MISSION_TIME_PRESETS
    : [...MISSION_TIME_PRESETS, { minutes: missionTimeMinutes, label: `${missionTimeMinutes}m`, devHours: "" }];
  const timeoutOptions = TIMEOUT_PRESETS.some((p) => p.minutes === timeoutMinutes)
    ? TIMEOUT_PRESETS
    : [...TIMEOUT_PRESETS, { minutes: timeoutMinutes, label: `${timeoutMinutes}m` }];

  const fields = (
    <>
      {!embedded && (
        <div className="space-y-1">
          <h3 className={sectionHeadingClasses}>
            Agent & runtime defaults
          </h3>
          <p className="text-micro text-ps-text-faint font-mono leading-relaxed">
            These fields feed the mission prompt and dispatch configuration.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <span className={LABEL}>Model</span>
          <ModelPicker
            id={modelPickerId}
            modelId={modelId}
            provider={provider}
            onChange={onModelChange}
            helperPlacement="tooltip"
          />
        </div>
        <div className="space-y-1.5">
          <span className={LABEL}>Agent profile</span>
          <ProfilePicker value={profileId} onChange={onProfileChange} size="lg" className="w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <span className={LABEL}>Mission scope</span>
          <Picker
            label="Mission scope"
            icon={Clock}
            size="lg"
            options={missionTimeOptions.map((p) => ({
              value: String(p.minutes),
              label: `${p.label} (${p.minutes}m)`,
              hint: p.devHours ? `≈ ${p.devHours} dev work` : undefined,
            }))}
            value={String(missionTimeMinutes)}
            onChange={(v) => onMissionTimeChange(Number(v))}
          />
        </div>
        <div className="space-y-1.5">
          <span className={LABEL}>
            {timeoutHeading}{" "}
            <span className="text-ps-text-faint font-normal normal-case">
              — Inactivity kill switch
            </span>
          </span>
          <Picker
            label={timeoutHeading}
            icon={Timer}
            size="lg"
            options={timeoutOptions.map((p) => ({ value: String(p.minutes), label: p.label }))}
            value={String(timeoutMinutes)}
            onChange={(v) => onTimeoutChange(Number(v))}
          />
        </div>
      </div>

      {showSkills && (
        <div className="space-y-1.5">
          <span className={LABEL}>
            Attached Skills{" "}
            <span className="text-ps-text-faint">(optional, max 10)</span>
          </span>
          <SkillsPicker
            value={skills}
            onChange={onSkillsChange}
            profileId={profileId}
            max={10}
          />
        </div>
      )}
    </>
  );

  // Embedded, the composer's accordion is the surface; on its own (the
  // template editor) it is a card nested in a modal, so the raised rung.
  if (embedded) return <div className="space-y-4">{fields}</div>;
  return (
    <Card variant="raised" padding="sm" className="sm:p-4 space-y-4">
      {fields}
    </Card>
  );
}
