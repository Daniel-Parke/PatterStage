"use client";

import { useCallback } from "react";
import { apiFetch, safeApiCall, safeApiCallData } from "@/lib/api-fetch";

/**
 * Centralized fetch helpers for the Missions page (keeps route strings in one place).
 */
export function useMissionsApi() {
  const fetchMissions = useCallback(async () => {
    const d = await apiFetch("/api/missions");
    return d.data?.missions ?? [];
  }, []);

  const fetchTemplates = useCallback(async () => {
    const d = await apiFetch("/api/templates");
    return d.data?.templates ?? [];
  }, []);

  const fetchMissionDetail = useCallback(async (id: string) => {
    const d = await apiFetch("/api/missions?id=" + encodeURIComponent(id));
    return d.data ?? null;
  }, []);

  const fetchCategories = useCallback(async () => {
    const d = await apiFetch("/api/mission-categories");
    return d.data?.categories ?? [];
  }, []);

  // `safeApiCallData` is the canonical "I need to make a JSON POST/PUT
  // and don't want to write Content-Type + JSON.stringify, AND I want
  // the inner payload unwrapped" wrapper. It stringifies the body and
  // returns the inner `data` field as `T | null` (or `null` on HTTP
  // error) so the call site stays 1 token each. The pre-refactor inline
  // form was passing `Content-Type: application/json` + `JSON.stringify({...})`
  // directly to `apiFetch` — both were redundant: `apiFetch` already
  // sets the header (see src/lib/api-fetch.ts), and `safeApiCallData` does
  // the stringification AND the envelope unwrap internally. `createCategory`
  // reads the inner `category` field to return the created row;
  // `updateCategory` is fire-and-forget so the `result` is ignored.
  const createCategory = useCallback(async (name: string, color?: string) => {
    // The route returns `{ data: { category: {...} } }` (envelope).
    // `safeApiCallData<T>` unwraps the envelope internally and returns
    // the inner payload (`T | null`), so the call site reads
    // `cat?.id` (1 level) instead of `result.data?.data?.category?.id`
    // (2 levels). The `null` fallback on HTTP error matches the
    // pre-refactor `?? null` form byte-for-byte.
    const inner = await safeApiCallData<{ category?: { id: string } }>(
      "/api/mission-categories",
      { method: "POST", body: { name, color } },
    );
    return inner?.category ?? null;
  }, []);

  const updateCategory = useCallback(
    async (
      id: string,
      patch: { name?: string; color?: string; sortOrder?: number },
    ) => {
      await safeApiCall("/api/mission-categories", {
        method: "PUT",
        body: { id, ...patch },
      });
    },
    [],
  );

  const deleteCategory = useCallback(
    async (id: string, reassignToId: string | null) => {
      const params = new URLSearchParams({ id });
      if (reassignToId) params.set("reassignToId", reassignToId);
      await apiFetch(`/api/mission-categories?${params.toString()}`, {
        method: "DELETE",
      });
    },
    [],
  );

  return {
    fetchMissions,
    fetchTemplates,
    fetchMissionDetail,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
