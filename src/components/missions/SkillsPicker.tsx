// ═══════════════════════════════════════════════════════════════
// SkillsPicker — the skills a mission recommends, chosen from the ones the
// profile has enabled.
//
// Was ui/SkillSelector, a hand-rolled menu with its own click-outside effect
// and no keyboard path. It is a Picker now, and it lives here because the
// mission composer is its only home (T-0125): a component with one caller is
// not a primitive, it is part of the screen that calls it.
// ═══════════════════════════════════════════════════════════════

"use client";

import { Cpu } from "lucide-react";

import Picker from "@/components/ui/Picker";
import { useProfileSkills } from "@/hooks/useProfileAttachables";

export interface SkillsPickerProps {
  value: string[];
  onChange: (skills: string[]) => void;
  profileId?: string;
  max?: number;
}

export default function SkillsPicker({ value, onChange, profileId, max = 10 }: SkillsPickerProps) {
  // Enabled skills only: the hook filters, so a disabled skill is never
  // offered for a mission the profile could not run it in.
  const { data, isLoading } = useProfileSkills(profileId);
  const options = (data ?? []).map((s) => ({ value: s.name, label: s.name, hint: s.category }));
  return (
    <div>
      <Picker
        label="Skills"
        multiple
        searchable
        max={max}
        size="lg"
        icon={Cpu}
        color="purple"
        loading={isLoading}
        options={options}
        value={value}
        onChange={onChange}
        placeholder={`Attach skills (enabled for profile, max ${max})…`}
        emptyText="No skills available"
      />
      <p className="mt-1 px-0.5 font-mono text-micro text-ps-text-faint">
        Showing only skills enabled for this profile.
      </p>
    </div>
  );
}
