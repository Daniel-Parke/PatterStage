// ═══════════════════════════════════════════════════════════════
// ToolsetsPicker — the toolsets a mission recommends.
//
// Was ui/ToolsetSelector. Prompt hints only: what a mission RUNS with comes
// from the profile's own toolset policy on Agent → Tools; this is what the
// prompt suggests. A Picker now, in the composer's own neighbourhood, for the
// same reason SkillsPicker is (T-0125).
// ═══════════════════════════════════════════════════════════════

"use client";

import { Wrench } from "lucide-react";

import Picker from "@/components/ui/Picker";
import { useProfileToolsets } from "@/hooks/useProfileAttachables";
import { useToolsetCatalog } from "@/hooks/useToolsetCatalog";

export interface ToolsetsPickerProps {
  value: string[];
  onChange: (toolsets: string[]) => void;
  profileId?: string;
  max?: number;
}

export default function ToolsetsPicker({ value, onChange, profileId, max = 10 }: ToolsetsPickerProps) {
  const { toolsetLabel } = useToolsetCatalog();
  const { data, isLoading } = useProfileToolsets(profileId);
  const options = (data ?? []).map((id) => ({ value: id, label: toolsetLabel(id), hint: id }));
  return (
    <div>
      <Picker
        label="Toolsets"
        multiple
        searchable
        max={max}
        size="lg"
        icon={Wrench}
        color="orange"
        loading={isLoading}
        options={options}
        value={value}
        onChange={onChange}
        placeholder="Recommend Hermes toolsets (optional)…"
        emptyText="No toolsets on this profile. Configure them on Agent → Tools."
      />
      <p className="mt-1 px-0.5 font-mono text-micro text-ps-text-faint">
        Prompt hints only. Runtime tools come from the profile&apos;s own toolset policy.
      </p>
    </div>
  );
}
