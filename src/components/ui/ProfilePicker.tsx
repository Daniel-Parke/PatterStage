// ═══════════════════════════════════════════════════════════════
// ProfilePicker — the one control for "which agent am I shaping?"
//
// Three screens chose the agent three ways: Agents with a column of cards,
// Skills with a dropdown in its header, Tools with a card in its body. T-0113
// made them share the SELECTION; this is the shared CONTROL, and it lives in
// the header of every profile-scoped screen so the most consequential piece of
// state in the group is always in the same place (T-0125).
//
// A thin Picker over useProfiles. It knows nothing about what a profile is
// for; the page that renders it decides what a change means, which is how the
// Tools page can ask before discarding unsaved work.
// ═══════════════════════════════════════════════════════════════

"use client";

import { User } from "lucide-react";

import Picker from "@/components/ui/Picker";
import { useProfiles } from "@/hooks/useProfiles";

export interface ProfilePickerProps {
  value: string;
  onChange: (profileId: string) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function ProfilePicker({ value, onChange, size = "md", className = "w-56" }: ProfilePickerProps) {
  const { data, isLoading } = useProfiles();
  const options = (data ?? []).map((p) => ({
    value: p.id,
    label: p.name,
    hint: p.description || undefined,
  }));
  return (
    <Picker
      label="Profile"
      icon={User}
      color="purple"
      size={size}
      loading={isLoading}
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Select profile"
      emptyText="No profiles found"
      className={className}
      data-testid="profile-picker"
    />
  );
}
