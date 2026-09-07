"use client";

// ═══════════════════════════════════════════════════════════════
// SettingsSubject — which agent these settings belong to
//
// Settings edits one file: the config.yaml of the agent at the configured
// home. Agents, Skills and Tools edit whichever profile is selected. Chapter 3
// of the quests walks an operator through all four in order, and Settings was
// the one screen that never named its subject, so an operator who had just
// given a new profile its skills and its toolsets went on to change "its"
// settings on a screen that had never heard of it (T-0113).
//
// The route cannot write another profile's file, so this does not pretend it
// can. It names the subject, and when the profile selected elsewhere is a
// different agent it says so and points at where that profile's own settings
// live: the Agents screen lists a config.yaml for every profile and opens it.
//
// Names come from the same list the pickers read, so the two screens call the
// same agent by the same name.
// ═══════════════════════════════════════════════════════════════

import Link from "next/link";
import { UserCog } from "lucide-react";

import { useProfiles } from "@/hooks/useProfiles";
import { useSelectedProfile } from "@/hooks/useSelectedProfile";

export default function SettingsSubject({ subject }: { subject: string }) {
  const { data: profiles } = useProfiles();
  const [selected] = useSelectedProfile();

  // A slug with no row is still the honest answer: better the id than a name
  // invented for it, and better either than silence about the subject.
  const nameOf = (slug: string) => profiles?.find((p) => p.id === slug)?.name ?? slug;
  const elsewhere = selected !== subject;

  return (
    <div className="flex items-start gap-3 rounded-ps-lg border border-ps-edge-hairline bg-ps-surface-panel px-4 py-3">
      <UserCog className="mt-0.5 h-4 w-4 shrink-0 text-neon-orange" />
      <div className="min-w-0 text-body">
        <p className="text-ps-text-secondary">These settings belong to {nameOf(subject)}.</p>
        {elsewhere && (
          <>
            <p className="mt-1 text-semantic-warning">
              You have {nameOf(selected)} selected on Agents, Skills and Tools. Nothing on this page
              reaches it: a profile keeps its own settings in its own config.yaml.
            </p>
            <Link href="/agent/profiles" className="mt-1 inline-block text-neon-orange hover:underline">
              Open it on Agents
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
