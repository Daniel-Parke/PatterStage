// ═══════════════════════════════════════════════════════════════
// AgentProfilesOverview — the standing note and the sync controls
//
// The SOUL.md/config.yaml explainer, the performance strip, the drift banner
// and the push/pull bar. The drift and sync-error counts are derived here
// from the profiles the page already passes down: the same single-pass
// reduce the page ran, next to the banner that is its only reader.
// ═══════════════════════════════════════════════════════════════

"use client";

import AgentPerformanceStrip from "@/components/agents/AgentPerformanceStrip";
import ConceptHint from "@/components/help/ConceptHint";
import ProfilesDriftBanner from "@/components/profiles/ProfilesDriftBanner";
import ProfileSyncBar from "@/components/profiles/ProfileSyncBar";
import type { AgentProfile } from "@/types/console";

export interface AgentProfilesOverviewProps {
  profiles: AgentProfile[];
  syncBusy: boolean;
  onPushAll: () => void;
  onPullAll: () => void;
  onImportDiscovered: () => void;
}

export default function AgentProfilesOverview({
  profiles,
  syncBusy,
  onPushAll,
  onPullAll,
  onImportDiscovered,
}: AgentProfilesOverviewProps) {
  const { driftCount, syncErrorCount } = profiles.reduce(
    (acc, p) => {
      if (p.syncStatus === "drift") acc.driftCount += 1;
      else if (p.syncStatus === "error") acc.syncErrorCount += 1;
      return acc;
    },
    { driftCount: 0, syncErrorCount: 0 },
  );

  return (
    <>
      {/* An operator meeting this page for the first time read five file
          names and two storage engines before they read what a profile is
          (T-0102, the copy). The mechanics are unchanged and one click away. */}
      <div className="mb-4 max-w-3xl">
        {/* Both of this screen's words are in this one sentence, which is
            where an operator meets them: "voice" is what the product calls a
            personality everywhere else on the page. */}
        <p className="text-body text-ps-text-muted">
          A <ConceptHint id="profile">profile</ConceptHint> is one agent: its{" "}
          <ConceptHint id="personality">voice</ConceptHint>, the skills it may use and the tools it
          may reach. Pick one in the header, or in the table, to read it or change it.
        </p>
        <details className="mt-1">
          <summary className="min-h-6.5 cursor-pointer text-body text-neon-cyan hover:underline">
            Where a profile is stored
          </summary>
          <p className="mt-2 text-micro text-ps-text-muted font-mono">
            Agent identity lives in <strong className="text-ps-text-secondary">SOUL.md</strong>. Runtime policy
            (skills.disabled, platform_toolsets, model blocks) is in each profile&apos;s{" "}
            <strong className="text-ps-text-secondary">config.yaml</strong>. Pull imports from Hermes disk into
            SQLite; push writes PatterStage back to disk.
          </p>
        </details>
      </div>

      <AgentPerformanceStrip />

      <ProfilesDriftBanner
        driftCount={driftCount}
        errorCount={syncErrorCount}
        onPushAll={onPushAll}
        pushing={syncBusy}
      />
      <ProfileSyncBar
        onPushAll={onPushAll}
        onPullAll={onPullAll}
        onImportDiscovered={onImportDiscovered}
        busy={syncBusy}
      />
    </>
  );
}
