// ═══════════════════════════════════════════════════════════════
// useModels / useModelDefaults — the registered model list + per-slot
// defaults. Thin useApiResource wrappers so ModelPicker stops fetching
// both endpoints by hand in a useEffect.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useApiResource } from "./useApiResource";

/** The row /api/models returns, spelled once in the library (C2, T-0137). */
import type { ApiModel } from "@/lib/models/model-types";
export type { ApiModel };

/** Shape of defaults returned by /api/models/defaults. */
export interface ApiDefaults {
  agent: string | null;
  hindsight: string | null;
  compression: string | null;
  vision: string | null;
  web_extract: string | null;
  session_search: string | null;
  title_generation: string | null;
  skills_hub: string | null;
  mcp: string | null;
  triage_specifier: string | null;
  approval: string | null;
  delegation: string | null;
}

export function useModels() {
  return useApiResource<ApiModel[]>("/api/models", {
    select: (payload) => (payload as { models?: ApiModel[] } | undefined)?.models,
    fallback: [],
    errorMessage: "Failed to load models",
  });
}

export function useModelDefaults() {
  return useApiResource<ApiDefaults | null>("/api/models/defaults", {
    select: (payload) => (payload as { defaults?: ApiDefaults } | undefined)?.defaults ?? null,
    fallback: null,
  });
}
