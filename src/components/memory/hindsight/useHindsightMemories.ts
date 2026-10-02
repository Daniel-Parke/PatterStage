// ═══════════════════════════════════════════════════════════════
// useHindsightMemories — memories tab state + recall/reflect/add + health.
// Keeps typed search separate from submitted recall; query results supply
// collection data and health, while explicit actions own their pending state.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback, useMemo } from "react";
import type { FeedbackContextValue } from "@/components/ui/feedback-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiQueryKey, useApiResource } from "@/hooks/useApiResource";
import {
  hindsightGet,
  selectHindsightData,
  filterMemoriesByAge,
  HINDSIGHT_DEFAULT_MAX_AGE_DAYS,
} from "@/lib/memory/hindsight-client";
import { parseOptionalTagsInput } from "@/lib/memory/hindsight-tag-input";
import { runWrite } from "@/lib/api/api-write";
import { stringOr } from "./utils";
import type { Memory, HealthState, Tab } from "./types";

type ShowToast = FeedbackContextValue["showToast"];

export function useHindsightMemories(showToast: ShowToast, activeTab: Tab = "memories") {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [reflectResult, setReflectResult] = useState<string | null>(null);
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  type MemoryResult = { memories?: Memory[]; total?: number; mode?: string; message?: string };
  const recentEndpoint = "/api/memory/hindsight?action=list&limit=50";
  const recallEndpoint = `/api/memory/hindsight?${new URLSearchParams({ action: "recall", query: submittedQuery ?? "" })}`;
  const recent = useApiResource<MemoryResult>(recentEndpoint, {
    enabled: activeTab === "memories" && submittedQuery === null,
    select: selectHindsightData<MemoryResult>, errorMessage: "Failed to load memories",
  });
  const recall = useApiResource<MemoryResult>(recallEndpoint, {
    enabled: activeTab === "memories" && submittedQuery !== null,
    select: selectHindsightData<MemoryResult>, errorMessage: "Failed to recall memories",
  });
  const read = submittedQuery === null ? recent : recall;
  const memories = useMemo(() => read.data?.memories ?? [], [read.data]);
  const loading = submittedQuery !== null && read.isFetching;
  const loadingInitial = submittedQuery === null && read.isLoading;
  const healthRead = useApiResource<HealthState>("/api/memory/hindsight?action=health", {
    enabled: activeTab === "memories" && Boolean(read.error),
    select: data => data as HealthState | undefined,
  });
  const health = useMemo<HealthState | null>(() => read.error
    ? healthRead.data ?? { available: false, mode: "unknown", message: "No response" }
    : read.data ? { available: true, mode: stringOr(read.data.mode, "ok"), message: stringOr(read.data.message) } : null,
  [read.error, read.data, healthRead.data]);
  const totalFacts = typeof recent.data?.total === "number" ? recent.data.total : null;
  const { mutateAsync: reflect, isPending: reflecting } = useMutation({
    retry: false,
    mutationFn: (query: string) => hindsightGet<{ response?: string; error?: string }>("reflect", { query }),
  });
  // Stale-fact filter toggle. When false (the default), memories older
  // than HINDSIGHT_DEFAULT_MAX_AGE_DAYS are hidden in the Memory tab.
  const [showStaleMemories, setShowStaleMemories] = useState(false);
  // Apply the age filter to the displayed memories list. The fetched
  // list (`memories`) is the source of truth; `displayedMemories` is
  // what the MemoryTab actually renders.
  const displayedMemories = useMemo(
    () => filterMemoriesByAge(
      memories,
      showStaleMemories ? Infinity : HINDSIGHT_DEFAULT_MAX_AGE_DAYS,
    ),
    [memories, showStaleMemories],
  );
  const hiddenStaleCount = memories.length - displayedMemories.length;

  // Add memory modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");
  const [adding, setAdding] = useState(false);

  const { refetch: refetchRecent } = recent;
  const { refetch: refetchRecall } = recall;
  const { refetch: refetchHealth } = healthRead;
  const fetchHealthOnly = useCallback(async () => { await refetchHealth(); }, [refetchHealth]);
  const loadRecentMemories = useCallback(async () => {
    setSubmittedQuery(null);
    await refetchRecent();
  }, [refetchRecent]);
  const runRecall = useCallback(async () => {
    const q = search.trim();
    if (!q) { showToast("Enter a search query first", "info"); return; }
    if (q === submittedQuery) await refetchRecall();
    else setSubmittedQuery(q);
  }, [search, submittedQuery, refetchRecall, showToast]);

  const handleRefreshMemories = () => {
    if (search.trim()) {
      void runRecall();
    } else {
      void loadRecentMemories();
    }
  };

  const handleReflect = async () => {
    if (!search.trim()) return;
    setReflectResult(null);
    const inner = await reflect(search);
    if (!inner || inner.error) {
      showToast("Reflection failed", "error");
    } else {
      setReflectResult(inner.response || "No reflection generated");
    }
  };

  const openAddModal = useCallback(() => setShowAddModal(true), [setShowAddModal]);
  const closeAddModal = useCallback(() => setShowAddModal(false), [setShowAddModal]);

  const handleAdd = async () => {
    if (!newContent.trim()) return false;
    const stored = await runWrite({
      setBusy: setAdding,
      showToast,
      url: "/api/memory/hindsight",
      body: { content: newContent, tags: parseOptionalTagsInput(newTags) },
      successMessage: "Memory stored",
      errorMessage: "Failed to store memory",
      onSuccess: async () => {
        setShowAddModal(false);
        setNewContent("");
        setNewTags("");
        const query = search.trim();
        const endpoint = query
          ? `/api/memory/hindsight?${new URLSearchParams({ action: "recall", query })}`
          : recentEndpoint;
        await client.cancelQueries({ queryKey: apiQueryKey(endpoint), exact: true });
        if (query) await runRecall();
        else await loadRecentMemories();
      },
    });
    return stored !== undefined;
  };

  return {
    memories,
    error: read.error,
    retry: read.refetch,
    submittedQuery,
    loading,
    loadingInitial,
    search,
    setSearch,
    reflectResult,
    reflecting,
    showStaleMemories,
    setShowStaleMemories,
    displayedMemories,
    hiddenStaleCount,
    showAddModal,
    newContent,
    setNewContent,
    newTags,
    setNewTags,
    adding,
    health,
    totalFacts,
    fetchHealthOnly,
    loadRecentMemories,
    runRecall,
    handleRefreshMemories,
    handleReflect,
    handleAdd,
    openAddModal,
    closeAddModal,
  };
}
