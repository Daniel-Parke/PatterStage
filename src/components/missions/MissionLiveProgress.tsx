// ═══════════════════════════════════════════════════════════════
// MissionLiveProgress — live SSE output for a running mission
//
// Self-contained: resolves the mission's current PatterStage run id (polling
// briefly until dispatch has created it), then streams agent output via the
// validated RunProgress + /api/runs/[id]/events chain.
//
// It used to render nothing at all when the run lookup failed, and the
// failure was indistinguishable from "dispatch has not created the run
// yet": both produced `null`, so the poll retried every two seconds
// forever and the panel stayed blank. A mission the operator had just
// dispatched simply showed nothing, with the real error (a 500, a
// dropped connection) discarded inside the queryFn. Now the two states
// are separate and the failure says what it was.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useQuery } from "@tanstack/react-query";
import { safeApiCall } from "@/lib/api-fetch";
import RunProgress from "@/components/schedule/RunProgress";
import ConceptHint from "@/components/help/ConceptHint";

/** Either the run id (null while dispatch has not created one) or the reason we could not ask. */
interface RunLookup {
  runId: string | null;
  error: string | null;
}

export default function MissionLiveProgress({ missionId }: { missionId: string }) {
  const { data } = useQuery<RunLookup>({
    queryKey: ["mission-run", missionId],
    queryFn: async (): Promise<RunLookup> => {
      const res = await safeApiCall<{ data?: { run?: { id?: string } | null } }>(
        `/api/missions/${missionId}/run`,
      );
      if (!res.ok) return { runId: null, error: res.error ?? "Could not read the mission's run" };
      return { runId: res.data?.data?.run?.id ?? null, error: null };
    },
    // Poll until a run id exists (dispatch may not have created it yet), then
    // stop. A failed lookup keeps polling, since the server may just be busy, but
    // the operator can now see that it is failing rather than waiting on a
    // blank panel.
    refetchInterval: (query) => (query.state.data?.runId ? false : 2000),
  });

  if (data?.error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs font-mono text-red-300">
        Live run unavailable: {data.error}
      </div>
    );
  }

  if (!data?.runId) return null;

  return (
    <div>
      {/* Where the word "run" is actually met on this screen: one dispatch of
          this mission, streaming underneath. */}
      <div className="text-xs font-mono text-ps-text-muted uppercase mb-1">
        Live <ConceptHint id="run">run</ConceptHint>
      </div>
      <RunProgress runId={data.runId} />
    </div>
  );
}
