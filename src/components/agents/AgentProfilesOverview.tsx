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
      <p className="text-xs text-white/40 font-mono mb-4 max-w-3xl">
        Agent identity lives in <strong className="text-white/60">SOUL.md</strong>. Runtime policy
        (skills.disabled, platform_toolsets, model blocks) is in each profile&apos;s{" "}
        <strong className="text-white/60">config.yaml</strong>. Pull imports from Hermes disk into
        SQLite; push writes PatterStage back to disk.
      </p>

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
