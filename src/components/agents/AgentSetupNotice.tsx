// ═══════════════════════════════════════════════════════════════
// AgentSetupNotice — "there is no agent behind this page yet"
// ═══════════════════════════════════════════════════════════════
//
// PatterStage starts fine without an agent installed, and several pages assume
// one. Before this, those pages just looked empty: Missions invited you to
// compose and dispatch with nothing to dispatch to, and the failure only showed
// up as a runtime error after you had written a mission.
//
// Drop this at the top of any page whose function depends on the agent. It
// renders nothing at all once the agent is configured, so it costs a configured
// operator one cached request and no pixels.
//
// Self-contained on purpose: adding it to a page is one import and one line,
// which is what makes it cheap to put on every surface that needs it.

"use client";

import { AlertTriangle, ArrowUpRight } from "lucide-react";

import { useApiResource } from "@/hooks/useApiResource";
import { AGENT_INSTALL_DOCS } from "@/lib/dashboard/first-run-steps";
import type { MonitorData } from "@/types/console";

interface AgentPresence {
  name: string;
  available: boolean;
}


export default function AgentSetupNotice({ what }: { what: string }) {
  // The monitor the dashboard polls, under the same key, so this costs no
  // request of its own on a screen that already has it (T-0129).
  const { data } = useApiResource<AgentPresence>("/api/monitor", {
    select: (p) => {
      const framework = (p as MonitorData | null)?.framework;
      return { name: framework?.name ?? "Hermes", available: framework?.available !== false };
    },
    staleTime: 60_000,
  });

  if (!data || data.available) return null;

  return (
    <div className="mx-6 mt-4 flex items-start gap-3 rounded-ps-lg border border-neon-orange/40 bg-neon-orange/10 px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-neon-orange" />
      <div className="min-w-0 text-body">
        <p className="font-semibold text-neon-orange">{data.name} is not installed</p>
        <p className="mt-0.5 text-ps-text-secondary">
          {what} needs an agent on this machine. You can configure PatterStage now, but nothing will
          actually run until {data.name} is installed.
        </p>
        <a
          href={AGENT_INSTALL_DOCS}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-1.5 inline-flex items-center gap-1 font-mono text-neon-orange hover:underline"
        >
          Install {data.name} <ArrowUpRight className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
