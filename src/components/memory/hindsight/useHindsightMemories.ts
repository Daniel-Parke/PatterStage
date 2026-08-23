// ═══════════════════════════════════════════════════════════════
// useHindsightMemories — memories tab state + recall/reflect/add + health.
// Extracted verbatim from HindsightBrowser. Owns the shared `search` and
// `health` state (health is only ever written by the memory fetch paths).
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type { ToastType } from "@/components/ui/Toast";
import {
  hindsightGet,
  filterMemoriesByAge,
  HINDSIGHT_DEFAULT_MAX_AGE_DAYS,
} from "@/lib/memory/hindsight-client";
import { parseOptionalTagsInput } from "@/lib/memory/hindsight-tag-input";
import { runMutation } from "@/lib/run-mutation";
import { stringOr } from "./utils";
import type { Memory, HealthState } from "./types";

type ShowToast = (message: string, type?: ToastType) => void;

export function useHindsightMemories(showToast: ShowToast) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [search, setSearch] = useState("");
  const [reflectResult, setReflectResult] = useState<string | null>(null);
  const [reflecting, setReflecting] = useState(false);
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

  // Health
  const [health, setHealth] = useState<HealthState | null>(null);
  // Real store size (from the list endpoint's `total`), distinct from the
  // loaded page (`memories.length`) — so the UI can show "N of TOTAL".
  const [totalFacts, setTotalFacts] = useState<number | null>(null);

  const fetchHealthOnly = useCallback(async () => {
    // `hindsightGet` returns the inner payload typed as `T | null`;
    // `null` covers both error and missing-data cases.
    const inner = await hindsightGet<HealthState>("health");
    if (inner) {
      setHealth(inner);
    } else {
      setHealth({ available: false, mode: "unknown", message: "No response" });
    }
  }, []);

  const loadRecentMemories = useCallback(async () => {
    setLoadingInitial(true);
    // Envelope-typed: the route returns
    // `{ data: { memories, mode, error } }`.
    const inner = await hindsightGet<{ memories?: Memory[]; total?: number; mode?: string; error?: string }>(
      "list",
      { limit: 50 },
    );
    // `hindsightGet` returns null on a non-2xx response, and an unreachable
    // Hindsight is exactly that: the route answers 503 with
    // `{ available: false, error: "fetch failed" }`. That null used to fall
    // into the success branch below, which left `health` at null, so the health
    // banner never rendered and the page told a first-time user "No memories
    // yet. Hermes will start storing them as you converse" while no memory
    // provider was running at all. A null response is a health question, not an
    // empty store.
    if (!inner || inner.error) {
      await fetchHealthOnly();
    } else {
      setMemories(inner.memories || []);
      setTotalFacts(typeof inner.total === "number" ? inner.total : null);
      setHealth({ available: true, mode: stringOr(inner.mode, "ok") });
    }
    setLoadingInitial(false);
  }, [fetchHealthOnly]);

  useEffect(() => {
    void loadRecentMemories();
  }, [loadRecentMemories]);

  const runRecall = useCallback(async () => {
    const q = search.trim();
    if (!q) {
      showToast("Enter a search query first", "info");
      return;
    }
    setLoading(true);
    try {
      // Envelope-typed: the route returns
      // `{ data: { memories, available, mode, message, error } }`.
      const inner = await hindsightGet<{
        memories?: Memory[];
        available?: boolean;
        mode?: string;
        message?: string;
        error?: string;
      }>("recall", { query: q });
      if (!inner) {
        await fetchHealthOnly();
        return;
      }
      setMemories(inner.memories || []);
      const backendSaysDown = inner.available === false || (typeof inner.error === "string" && inner.error.length > 0);
      if (!backendSaysDown) {
        setHealth({
          available: true,
          mode: stringOr(inner.mode, "ok"),
          message: stringOr(inner.message),
        });
      } else {
        await fetchHealthOnly();
      }
    } finally {
      setLoading(false);
    }
  }, [search, showToast, fetchHealthOnly]);

  const handleRefreshMemories = () => {
    if (search.trim()) {
      void runRecall();
    } else {
      void loadRecentMemories();
    }
  };

  const handleReflect = async () => {
    if (!search.trim()) return;
    setReflecting(true);
    setReflectResult(null);
    // Single-nesting: type param is the inner `{response}` shape.
    const inner = await hindsightGet<{ response?: string }>("reflect", { query: search });
    setReflecting(false);
    if (!inner) {
      showToast("Reflection failed", "error");
    } else {
      setReflectResult(inner.response || "No reflection generated");
    }
  };

  const openAddModal = useCallback(() => setShowAddModal(true), [setShowAddModal]);
  const closeAddModal = useCallback(() => setShowAddModal(false), [setShowAddModal]);

  const handleAdd = () =>
    runMutation(showToast, {
      isValid: () => newContent.trim().length > 0,
      busy: setAdding,
      build: () => ({
        content: newContent,
        tags: parseOptionalTagsInput(newTags),
      }),
      path: "/api/memory/hindsight",
      successMsg: "Memory stored",
      errorMsg: "Failed to store memory",
      onSuccess: async () => {
        setShowAddModal(false);
        setNewContent("");
        setNewTags("");
        if (search.trim()) await runRecall();
        else await loadRecentMemories();
      },
    });

  return {
    memories,
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
