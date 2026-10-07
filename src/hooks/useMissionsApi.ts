"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { readApiResource } from "@/hooks/useApiResource";
import type { MissionDetail, MissionRow } from "@/hooks/missions-page-types";
import type { MissionTemplate } from "@/components/missions/TemplateModals";
import type { ManagedCategory } from "@/components/missions/CategoryManagerModal";

/**
 * Centralized fetch helpers for the Missions page (keeps route strings in one place).
 */
export function useMissionsApi() {
  const client = useQueryClient();
  const fetchMissions = useCallback((afterWrite = false) => readApiResource(client, "/api/missions?limit=200", {
    select: (p) => (p as { missions?: MissionRow[] } | null)?.missions,
    fallback: [],
  }, afterWrite), [client]);

  const fetchTemplates = useCallback((afterWrite = false) => readApiResource(client, "/api/templates", {
    select: (p) => (p as { templates?: MissionTemplate[] } | null)?.templates,
    fallback: [],
  }, afterWrite), [client]);

  const fetchMissionDetail = useCallback((id: string, afterWrite = false) => readApiResource(client, "/api/missions?id=" + encodeURIComponent(id), {
    select: (p) => p as MissionDetail | null,
  }, afterWrite), [client]);

  const fetchCategories = useCallback((afterWrite = false) => readApiResource(client, "/api/mission-categories", {
    select: (p) => (p as { categories?: ManagedCategory[] } | null)?.categories,
    fallback: [],
  }, afterWrite), [client]);


  return {
    fetchMissions,
    fetchTemplates,
    fetchMissionDetail,
    fetchCategories,
  };
}
