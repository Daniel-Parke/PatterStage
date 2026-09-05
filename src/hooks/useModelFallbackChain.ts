// ═══════════════════════════════════════════════════════════════
// useModelFallbackChain — the ordered chain of fallback models
// ═══════════════════════════════════════════════════════════════
//
// Split out of useModelsPage (Phase 4 god-file decomposition). Owns the
// chain itself: reorder, toggle, delete, add-from-registry, add-custom,
// import-from-Hermes, and the per-entry base-URL override modal.
//
// Every one of those six is the same mutation shape, so they all run
// through `runFallbackMutation`. The chain's *settings* (retry
// threshold, restore-on-fallback, notification) are a separate concern
// with a debounce and a generation guard, and live in
// useModelFallbackConfig.

"use client";

import { useCallback, useState } from "react";

import type { ToastType } from "@/components/ui/Toast";
import { apiFetch, toastError } from "@/lib/api-fetch";
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

  /**
   * Shared helper for the fallback-chain CRUD handlers (reorder, toggle,
   * delete, add-from-registry, add-custom, import-from-config). They all
   * do the same thing: optionally mark a busy state, call the API, refetch,
   * toast success; on failure, toast the error and still clear the busy
   * state. Edit + config flows have side-effects (closing the modal,
   * optimistic UI, debounced save) that don't fit this pattern — those
   * stay as bespoke handlers.
   *
   * The optional `setBusy` parameter mirrors the same pattern that
   * `runSyncAction` (in `@/lib/operation-sync-action.ts`) uses for the
   * operations pages: the helper calls `setBusy(true)` at the start of
   * the mutation and `setBusy(false)` in a `finally` block, so callers
   * that need a spinner (e.g. `handleImportFallbackFromConfig` setting
   * `importingFallback` for the "Import" button) get the lifecycle
   * without duplicating the try/catch/finally boilerplate. Callers that
   * don't need a spinner (the 5 fallback-chain CRUD handlers) simply
   * omit the param; the default is a no-op, so their behaviour is
   * unchanged.
   */
  const runFallbackMutation = useCallback(
    async (
      successMessage: string,
      errorFallback: string,
      url: string,
      init: { method: "POST" | "PUT" | "DELETE"; body?: string },
      setBusy?: (busy: boolean) => void,
    ): Promise<void> => {
      const setBusyFn = setBusy ?? (() => undefined);
      setBusyFn(true);
      try {
        await apiFetch(url, init);
        await loadAll();
        showToast(successMessage, "success");
      } catch (err) {
        toastError(showToast, err, errorFallback);
      } finally {
        setBusyFn(false);
      }
    },
    [loadAll, showToast]
  );

  const handleFallbackReorder = useCallback(
    async (entryId: string, direction: "up" | "down") =>
      runFallbackMutation(
        "Fallback chain reordered",
        "Reorder failed",
        "/api/models/fallbacks",
        { method: "POST", body: JSON.stringify({ action: "reorder", entryId, direction }) },
      ),
    [runFallbackMutation]
  );

  const handleFallbackToggle = useCallback(
    async (entryId: string, enabled: boolean) =>
      runFallbackMutation(
        enabled ? "Fallback model enabled" : "Fallback model disabled",
        "Toggle failed",
        "/api/models/fallbacks",
        { method: "POST", body: JSON.stringify({ action: "toggle", entryId, enabled }) },
      ),
    [runFallbackMutation]
  );

  const handleFallbackDelete = useCallback(
    async (entryId: string) =>
      runFallbackMutation(
        "Fallback model removed",
        "Delete failed",
        `/api/models/fallbacks/${encodeURIComponent(entryId)}`,
        { method: "DELETE" },
      ),
    [runFallbackMutation]
  );

  const handleFallbackEdit = useCallback((entry: FallbackChainEntry) => {
    setFallbackEdit({ entry, url: entry.overrideBaseUrl || "", saving: false });
  }, []);

  const handleFallbackEditSave = useCallback(async () => {
    const current = fallbackEdit;
    if (!current.entry) return;
    const entry = current.entry;
    const overrideUrl = current.url;
    setFallbackEdit((prev) => ({ ...prev, saving: true }));
    try {
      await apiFetch(`/api/models/fallbacks/${encodeURIComponent(entry.id)}`, {
        method: "PUT",
        body: JSON.stringify({ overrideBaseUrl: overrideUrl.trim() || null }),
      });
      await loadAll();
      setFallbackEdit({ entry: null, url: "", saving: false });
      showToast("Fallback updated", "success");
    } catch (err) {
      toastError(showToast, err, "Update failed");
      setFallbackEdit((prev) => ({ ...prev, saving: false }));
    }
  }, [fallbackEdit, loadAll, showToast]);

  const handleFallbackAddFromRegistry = useCallback(
    async (modelId: string) =>
      runFallbackMutation(
        "Fallback model added from registry",
        "Add failed",
        "/api/models/fallbacks",
        { method: "POST", body: JSON.stringify({ action: "add", modelId }) },
      ),
    [runFallbackMutation]
  );

  const handleFallbackAddCustom = useCallback(
    async (name: string, provider: string, modelIdString: string, baseUrl?: string) =>
      runFallbackMutation(
        "Custom fallback model added",
        "Add failed",
        "/api/models/fallbacks",
        { method: "POST", body: JSON.stringify({ action: "custom", name, provider, modelIdString, baseUrl }) },
      ),
    [runFallbackMutation]
  );

  // ── handleImportFallbackFromConfig ───────────────────────────────
  //
  // Migrated to `runFallbackMutation` (which gained an optional
  // `setBusy` parameter to absorb the importing-fallback busy state).
  // Pre-refactor: 14 lines of inline `try { apiFetch + loadAll +
  // showToast } catch { toastError } finally { setImportingFallback
  // (false) }`. Post-refactor: a single 5-line `runFallbackMutation`
  // call. The order of operations is byte-equivalent:
  //   1. `setImportingFallback(true)` (via the setBusy param)
  //   2. `await apiFetch("/api/models/fallbacks/import", { method: "POST" })`
  //   3. `await loadAll()` (re-fetch the chain + config + drift)
  //   4. `showToast("Fallback config imported from Hermes", "success")`
  //   5. `setImportingFallback(false)` (via the setBusy param, in
  //      a `finally` block — fires on both success and failure paths)
  // The error path's `toastError(showToast, err, "Import failed")` is
  // preserved (the helper's `errorFallback` parameter is wired to it).
  // `importingFallback` remains in the hook's public return surface
  // (read by `ModelsFallbackSection.tsx` for the Import button's
  // busy state) — only the `setImportingFallback(true/false)` call
  // sites moved into the helper via the `setBusy` adapter.
  const handleImportFallbackFromConfig = useCallback(
    () =>
      runFallbackMutation(
        "Fallback config imported from Hermes",
        "Import failed",
        "/api/models/fallbacks",
        { method: "POST", body: JSON.stringify({ action: "import" }) },
        setImportingFallback,
      ),
    [runFallbackMutation],
  );

  return {
    importingFallback,
    // Fallback-edit state is consolidated into `fallbackEdit` internally;
    // expose the 3 fields the page-level consumer reads in their original
    // shape so the ModelsFallbackSection component contract is unchanged.
    editingFallbackEntry: fallbackEdit.entry,
    editingFallbackUrl: fallbackEdit.url,
    // `setEditingFallbackUrl` is a partial-update shim — the caller only
    // ever sets the url field (e.g. from the <input> onChange), so the
    // shim is narrower than `setFallbackEdit` and keeps the
    // ModelsFallbackSection props interface byte-equivalent to the
    // pre-refactor form.
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
    // `setEditingFallbackEntry` is a close-modal shim — the consumer
    // calls it with `null` to dismiss the modal. Equivalent to
    // `setFallbackEdit({ entry: null, url: "", saving: false })`.
    setEditingFallbackEntry: (entry: FallbackChainEntry | null) =>
      setFallbackEdit({ entry, url: entry?.overrideBaseUrl || "", saving: false }),
  };
}
