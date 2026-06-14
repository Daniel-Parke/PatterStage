// ═══════════════════════════════════════════════════════════════
// MissionLiveProgress — live SSE output for a running mission
//
// Self-contained: resolves the mission's current Control Hub run id (polling
// briefly until dispatch has created it), then streams agent output via the
// validated RunProgress + /api/runs/[id]/events chain. Renders nothing until a
// run exists, so it is safe to drop into the detail panel unconditionally for
// dispatched missions.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useQuery } from "@tanstack/react-query";
import { safeApiCall } from "@/lib/api-fetch";
import RunProgress from "@/components/schedule/RunProgress";

export default function MissionLiveProgress({ missionId }: { missionId: string }) {
  const { data: runId } = useQuery({
    queryKey: ["mission-run", missionId],
    queryFn: async (): Promise<string | null> => {
      const res = await safeApiCall<{ data?: { run?: { id?: string } | null } }>(
        `/api/missions/${missionId}/run`,
      );
      return res.ok ? (res.data?.data?.run?.id ?? null) : null;
    },
    // Poll until a run id exists (dispatch may not have created it yet), then stop.
    refetchInterval: (query) => (query.state.data ? false : 2000),
  });

  if (!runId) return null;

  return (
    <div>
      <div className="text-[10px] font-mono text-white/30 uppercase mb-1">Live run</div>
      <RunProgress runId={runId} />
    </div>
  );
}
