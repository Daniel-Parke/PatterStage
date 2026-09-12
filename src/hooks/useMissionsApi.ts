"use client";

import { useCallback } from "react";
import { apiFetch } from "@/lib/api/api-fetch";

/**
 * Centralized fetch helpers for the Missions page (keeps route strings in one place).
 */
export function useMissionsApi() {
  const fetchMissions = useCallback(async () => {
    const d = await apiFetch("/api/missions?limit=200");
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


  return {
    fetchMissions,
    fetchTemplates,
    fetchMissionDetail,
    fetchCategories,
  };
}
