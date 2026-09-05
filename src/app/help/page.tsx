// Help — a placeholder until B16 renders the docs in the app (T-0097). It
// exists so the rail's Home entry leads somewhere that says what is coming.

"use client";

import { LifeBuoy } from "lucide-react";

import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";

export default function HelpPage() {
  return (
    <AppPageShell>
      <PageHeader icon={LifeBuoy} subtitle="A guide for every screen, and the ideas behind it" color="cyan" />
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-3 flex-1 w-full">
        <p className="text-sm text-ps-text-secondary">
          Help arrives with this release: one guide per screen, a tour with a screenshot of each, and the twelve ideas a
          new operator meets (agents, prompts, tools, skills, memory, models, missions and the rest), rendered here from
          the same pages the documentation site is built from.
        </p>
        <p className="text-xs text-ps-text-muted font-mono">
          Until then, the docs folder in the repository is the reference.
        </p>
      </div>
    </AppPageShell>
  );
}
