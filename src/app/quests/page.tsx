// Quests — a placeholder until B17 ships the chains (T-0097). It exists so the
// rail's Home entry leads somewhere that says what is coming, rather than a 404.

"use client";

import { Trophy } from "lucide-react";

import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";

export default function QuestsPage() {
  return (
    <AppPageShell>
      <PageHeader icon={Trophy} subtitle="Real actions, tracked, from your first message to your first backup" color="orange" />
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-3 flex-1 w-full">
        <p className="text-sm text-ps-text-secondary">
          Quests arrive with this release: seven short chains that take you from a first chat to a scheduled mission,
          a shaped agent, a multi-stage workflow and a backup, each step proven by something you actually did.
        </p>
        <p className="text-xs text-ps-text-muted font-mono">
          Until then, the dashboard&apos;s first-run checklist is the guide.
        </p>
      </div>
    </AppPageShell>
  );
}
