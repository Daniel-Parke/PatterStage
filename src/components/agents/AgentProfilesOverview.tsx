// ═══════════════════════════════════════════════════════════════
// AgentProfilesOverview — the standing note and the sync controls
//
// Extracted verbatim from app/operations/agents/page.tsx: the
// SOUL.md/config.yaml explainer, the performance strip, the drift
// banner and the push/pull bar.
//
// The drift and sync-error counts are derived here from the profiles
// the page already passes down. It is the same single-pass reduce the
// page ran, moved next to the banner that is its only reader; nothing
// about what renders changes.
// ═══════════════════════════════════════════════════════════════

"use client";

import AgentPerformanceStrip from "@/components/agents/AgentPerformanceStrip";
import ProfilesDriftBanner from "@/components/profiles/ProfilesDriftBanner";
import ProfileSyncBar from "@/components/profiles/ProfileSyncBar";
import type { AgentProfile } from "@/types/console";

export interface AgentProfilesOverviewProps {
  profiles: AgentProfile[];
  selectedProfileId: string | null;
  syncBusy: boolean;
  onPushAll: () => void;
  onPullAll: () => void;
  onImportDiscovered: () => void;
  onPushOne: (slug: string) => void;
  onPullOne: (slug: string) => void;
}

export default function AgentProfilesOverview({
  profiles,
  selectedProfileId,
  syncBusy,
  onPushAll,
  onPullAll,
  onImportDiscovered,
  onPushOne,
  onPullOne,
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
        <p className="text-sm text-ps-text-muted">
          A profile is one agent: its voice, the skills it may use and the tools it may reach.
          Pick one on the left to read it or change it.
        </p>
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-neon-cyan hover:underline">
            Where a profile is stored
          </summary>
          <p className="mt-2 text-xs text-ps-text-muted font-mono">
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
        selectedSlug={selectedProfileId}
        onPushAll={onPushAll}
        onPullAll={onPullAll}
        onImportDiscovered={onImportDiscovered}
        onPushOne={onPushOne}
        onPullOne={onPullOne}
        busy={syncBusy}
      />
    </>
  );
}
