"use client";

import { useApiResource } from "@/hooks/useApiResource";
import RunProgress from "@/components/schedule/RunProgress";
import ConceptHint from "@/components/help/ConceptHint";

/** The run id, or null while dispatch has not created one. */
interface RunLookup {
  runId: string | null;
}

export default function MissionLiveProgress({ missionId }: { missionId: string }) {
  // Polls every two seconds until the run exists, then stops: the interval is
  // a function of what was read (T-0129), which is what the raw useQuery did
  // with its own state before every read went through the one hook.
  const { data, error } = useApiResource<RunLookup>(`/api/missions/${missionId}/run`, {
    select: (p) => ({ runId: (p as { run?: { id?: string } | null } | null)?.run?.id ?? null }),
    errorMessage: "Could not read the mission's run",
    refetchInterval: (value) => (value?.runId ? false : 2000),
  });

  if (error) {
    return (
      <div className="rounded-ps-lg border border-red-500/20 bg-red-500/5 p-3 text-micro font-mono text-red-300">
        Live run unavailable: {error}
      </div>
    );
  }

  if (!data?.runId) return null;

  return (
    <div>
      {/* Where the word "run" is actually met on this screen: one dispatch of
          this mission, streaming underneath. */}
      <div className="text-micro font-mono text-ps-text-muted uppercase mb-1">
        Live <ConceptHint id="run">run</ConceptHint>
      </div>
      <RunProgress runId={data.runId} />
    </div>
  );
}
