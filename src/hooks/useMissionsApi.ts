"use client";

import { useCallback } from "react";

/**
 * Centralized fetch helpers for the Missions page (keeps route strings in one place).
 */
export function useMissionsApi() {
  const fetchMissions = useCallback(async () => {
    const r = await fetch("/api/missions");
    const d = await r.json();
    return d.data?.missions ?? [];
  }, []);

  const fetchTemplates = useCallback(async () => {
    const r = await fetch("/api/templates");
    const d = await r.json();
    return d.data?.templates ?? [];
  }, []);

  const fetchMissionDetail = useCallback(async (id: string) => {
    const r = await fetch("/api/missions?id=" + encodeURIComponent(id));
    const d = await r.json();
    return d.data ?? null;
  }, []);

  return { fetchMissions, fetchTemplates, fetchMissionDetail };
}
