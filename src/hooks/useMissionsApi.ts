"use client";

import { useCallback } from "react";
import { apiFetch, safeApiCall } from "@/lib/api-fetch";

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

  // `safeApiCall` is the canonical "I need to make a JSON POST/PUT and
  // don't want to write Content-Type + JSON.stringify" wrapper. It
  // stringifies the body and returns `{ ok, data, error? }` so the
  // call sites stay 1 token each. The pre-refactor inline form was
  // passing `Content-Type: application/json` + `JSON.stringify({...})`
  // directly to `apiFetch` — both were redundant: `apiFetch` already
  // sets the header (see src/lib/api-fetch.ts), and `safeApiCall` does
  // the stringification internally. `createCategory` reads the inner
  // `data?.category` to return the created row; `updateCategory` is
  // fire-and-forget so the `result` is ignored.
  const createCategory = useCallback(async (name: string, color?: string) => {
    // The route returns `{ data: { category: {...} } }` (envelope). Drop
    // the redundant `{ data?: { ... } }` envelope: `safeApiCall<T>`
    // already wraps the response as `{ data?: T }`, so the inner type
    // only needs the inner shape. Byte-equivalent — the same
    // `{ ok, data?, error? }` envelope is returned, just without the
    // double-nesting at the call site. Reading the inner category is
    // `result.data?.category` (one indirection, matching `safeApiCall<T>`'s
    // contract).
    const result = await safeApiCall<{ category?: { id: string } }>(
      "/api/mission-categories",
      { method: "POST", body: { name, color } },
    );
    return result.data?.category ?? null;
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
