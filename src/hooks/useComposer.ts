// ═══════════════════════════════════════════════════════════════
// useComposer — workflows, runs, and one run's live detail.
// Thin useApiResource wrappers for the Composer page (paired with
// useEventStream for live updates).
// ═══════════════════════════════════════════════════════════════

"use client";

import { useApiResource } from "./useApiResource";
import type {
  ComposerNodeRun,
  ComposerRun,
  ComposerWorkflow,
  ComposerWorkflowGraph,
} from "@/lib/composer/schema";

export function useComposerWorkflows() {
  return useApiResource<ComposerWorkflow[]>(["composer-workflows"], "/api/composer/workflows", {
    select: (p) => (p as { workflows?: ComposerWorkflow[] } | undefined)?.workflows,
    fallback: [],
  });
}

export function useComposerRuns(refetchInterval: number | false = 4000) {
  return useApiResource<ComposerRun[]>(["composer-runs"], "/api/composer/runs", {
    select: (p) => (p as { runs?: ComposerRun[] } | undefined)?.runs,
    fallback: [],
    refetchInterval,
  });
}

export interface ComposerRunDetail {
  run: ComposerRun;
  nodeRuns: ComposerNodeRun[];
  graph: ComposerWorkflowGraph | null;
}

export function useComposerRun(id: string | null) {
  return useApiResource<ComposerRunDetail>(["composer-run", id ?? "none"], `/api/composer/runs/${id ?? ""}`, {
    select: (p) => {
      const v = p as Partial<ComposerRunDetail> | undefined;
      return v?.run ? { run: v.run, nodeRuns: v.nodeRuns ?? [], graph: v.graph ?? null } : undefined;
    },
    enabled: Boolean(id),
    refetchInterval: 3000,
  });
}
