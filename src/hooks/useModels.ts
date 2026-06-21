// ═══════════════════════════════════════════════════════════════
// useModels / useModelDefaults — the registered model list + per-slot
// defaults. Thin useApiResource wrappers so ModelPicker stops fetching
// both endpoints by hand in a useEffect.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useApiResource } from "./useApiResource";

/** Minimal shape of a model returned by /api/models. */
export interface ApiModel {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  baseUrl: string | null;
  contextLength: number | null;
  credentialsId: string | null;
  createdAt: string;
  updatedAt: string;
}

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
  return useApiResource<ApiModel[]>(["models"], "/api/models", {
    select: (payload) => (payload as { models?: ApiModel[] } | undefined)?.models,
    fallback: [],
    errorMessage: "Failed to load models",
  });
}

export function useModelDefaults() {
  return useApiResource<ApiDefaults | null>(["model-defaults"], "/api/models/defaults", {
    select: (payload) => (payload as { defaults?: ApiDefaults } | undefined)?.defaults ?? null,
    fallback: null,
  });
}
