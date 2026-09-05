// ═══════════════════════════════════════════════════════════════
// useDeepResearch — list research runs + poll one run's steps.
// Thin useApiResource wrappers for the Laboratory DeepResearch page.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useApiResource } from "./useApiResource";
import type { ResearchPreset, ResearchRun, ResearchStep } from "@/lib/laboratory/deep-research/types";

/** Saved Deep Research presets. */
export function useResearchPresets() {
  return useApiResource<ResearchPreset[]>(["research-presets"], "/api/laboratory/research/presets", {
    select: (payload) => (payload as { presets?: ResearchPreset[] } | undefined)?.presets,
    fallback: [],
  });
}

/** Recent research runs. Polls so pending → completed transitions surface. */
export function useResearchRuns(refetchInterval: number | false = 4000) {
  return useApiResource<ResearchRun[]>(["research-runs"], "/api/laboratory/research", {
    select: (payload) => (payload as { runs?: ResearchRun[] } | undefined)?.runs,
    fallback: [],
    refetchInterval,
  });
}

/** One research run + its steps. Polls while a run is selected. */
export function useResearchRun(id: string | null) {
  return useApiResource<{ run: ResearchRun; steps: ResearchStep[] }>(
    ["research-run", id ?? "none"],
    `/api/laboratory/research/${id ?? ""}`,
    {
      select: (payload) => {
        const v = payload as { run?: ResearchRun; steps?: ResearchStep[] } | undefined;
        return v?.run ? { run: v.run, steps: v.steps ?? [] } : undefined;
      },
      enabled: Boolean(id),
      refetchInterval: 3000,
    },
  );
}
