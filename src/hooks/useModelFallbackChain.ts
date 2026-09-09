// ═══════════════════════════════════════════════════════════════
// useModelFallbackChain — the ordered chain of fallback models
// ═══════════════════════════════════════════════════════════════
//
// Owns the chain itself: reorder, toggle, delete, add-from-registry,
// add-custom, import-from-Hermes, and the per-entry base-URL override
// modal. Every write is a `runWrite` with its words and the chain's
// reload. The chain's *settings* (retry threshold, restore-on-fallback,
// notification) are a separate concern with a debounce and a generation
// guard, and live in useModelFallbackConfig.

"use client";

import { useCallback, useState } from "react";

import type { ToastType } from "@/components/ui/Toast";
import { runWrite, type RunWriteOptions } from "@/lib/api-write";
import type { FallbackChainEntry } from "@/types/console";

type ToastFn = (message: string, type?: ToastType) => void;

export interface UseModelFallbackChainArgs {
  loadAll: () => Promise<void>;
  showToast: ToastFn;
}

export function useModelFallbackChain({
  loadAll,
  showToast,
}: UseModelFallbackChainArgs) {
  const [importingFallback, setImportingFallback] = useState(false);
  // The 3 fallback-edit useState calls (entry / url / saving) are tightly
  // coupled — they always transition together (open: entry+url set, saving
  // reset; close: all 3 clear; save: saving flips true→false). Consolidate
  // into a single state object so the "set 3 fields to 3 different things"
  // race that was possible with separate useState calls is structurally
  // impossible. The page-level page.tsx still receives 3 distinct fields
  // (`editingFallbackEntry`, `editingFallbackUrl`, `savingFallbackUrl`)
  // so the public surface is unchanged.
  const [fallbackEdit, setFallbackEdit] = useState<{
    entry: FallbackChainEntry | null;
    url: string;
    saving: boolean;
  }>({ entry: null, url: "", saving: false });

  /** A write to the chain: the words, the call, the chain reloaded. */
  const write = useCallback(
    (opts: Omit<RunWriteOptions, "showToast" | "onSuccess"> & { onSuccess?: () => void }) =>
      runWrite({
        ...opts,
        showToast,
        onSuccess: async () => {
          await loadAll();
          opts.onSuccess?.();
        },
      }),
    [loadAll, showToast],
  );

  const handleFallbackReorder = useCallback(
    async (entryId: string, direction: "up" | "down") => {
      await write({
        url: "/api/models/fallbacks",
        body: { action: "reorder", entryId, direction },
        successMessage: "Fallback chain reordered",
        errorMessage: "Reorder failed",
      });
    },
    [write],
  );

  const handleFallbackToggle = useCallback(
    async (entryId: string, enabled: boolean) => {
      await write({
        url: "/api/models/fallbacks",
        body: { action: "toggle", entryId, enabled },
        successMessage: enabled ? "Fallback model enabled" : "Fallback model disabled",
        errorMessage: "Toggle failed",
      });
    },
    [write],
  );

  const handleFallbackDelete = useCallback(
    async (entryId: string) => {
      await write({
        url: `/api/models/fallbacks/${encodeURIComponent(entryId)}`,
        method: "DELETE",
        successMessage: "Fallback model removed",
        errorMessage: "Delete failed",
      });
    },
    [write],
  );

  const handleFallbackEdit = useCallback((entry: FallbackChainEntry) => {
    setFallbackEdit({ entry, url: entry.overrideBaseUrl || "", saving: false });
  }, []);

  const handleFallbackEditSave = useCallback(async () => {
    const { entry, url } = fallbackEdit;
    if (!entry) return;
    await write({
      setBusy: (saving) => setFallbackEdit((prev) => ({ ...prev, saving })),
      url: `/api/models/fallbacks/${encodeURIComponent(entry.id)}`,
      method: "PUT",
      body: { overrideBaseUrl: url.trim() || null },
      successMessage: "Fallback updated",
      errorMessage: "Update failed",
      onSuccess: () => setFallbackEdit({ entry: null, url: "", saving: false }),
    });
  }, [fallbackEdit, write]);

  const handleFallbackAddFromRegistry = useCallback(
    async (modelId: string) => {
      await write({
        url: "/api/models/fallbacks",
        body: { action: "add", modelId },
        successMessage: "Fallback model added from registry",
        errorMessage: "Add failed",
      });
    },
    [write],
  );

  const handleFallbackAddCustom = useCallback(
    async (name: string, provider: string, modelIdString: string, baseUrl?: string) => {
      await write({
        url: "/api/models/fallbacks",
        body: { action: "custom", name, provider, modelIdString, baseUrl },
        successMessage: "Custom fallback model added",
        errorMessage: "Add failed",
      });
    },
    [write],
  );

  const handleImportFallbackFromConfig = useCallback(async () => {
    await write({
      setBusy: setImportingFallback,
      url: "/api/models/fallbacks",
      body: { action: "import" },
      successMessage: "Fallback config imported from Hermes",
      errorMessage: "Import failed",
    });
  }, [write]);

  return {
    importingFallback,
    editingFallbackEntry: fallbackEdit.entry,
    editingFallbackUrl: fallbackEdit.url,
    setEditingFallbackUrl: (url: string) =>
      setFallbackEdit((prev) => ({ ...prev, url })),
    savingFallbackUrl: fallbackEdit.saving,
    handleFallbackReorder,
    handleFallbackToggle,
    handleFallbackDelete,
    handleFallbackEdit,
    handleFallbackEditSave,
    handleFallbackAddFromRegistry,
    handleFallbackAddCustom,
    handleImportFallbackFromConfig,
    setEditingFallbackEntry: (entry: FallbackChainEntry | null) =>
      setFallbackEdit({ entry, url: entry?.overrideBaseUrl || "", saving: false }),
  };
}
