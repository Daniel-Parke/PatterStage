// ═══════════════════════════════════════════════════════════════
// useModelFallbackConfig — the fallback settings and their save
// ═══════════════════════════════════════════════════════════════
//
// Split out of useModelsPage (Phase 4 god-file decomposition). Owns the
// three settings that govern the chain (restore-primary, notification,
// retry threshold) and the only interesting thing about them: the save
// is debounced 400ms, guarded by a generation counter so a superseded
// PUT cannot clobber a newer one, and flushed before the sync-to-Hermes
// call so the file Hermes reads matches what the user just typed.
//
// The value itself is loaded by `loadAll` and therefore lives in
// useModelsRegistry; this hook writes back through the setter it is
// given rather than holding a second copy that could drift.

"use client";

import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { ToastType } from "@/components/ui/Toast";
import { safeApiCall } from "@/lib/api-fetch";
import { runWrite } from "@/lib/api-write";
import type { FallbackConfig } from "@/types/console";

type ToastFn = (message: string, type?: ToastType) => void;

export interface UseModelFallbackConfigArgs {
  fallbackConfig: FallbackConfig;
  setFallbackConfig: Dispatch<SetStateAction<FallbackConfig>>;
  showToast: ToastFn;
}

export function useModelFallbackConfig({
  fallbackConfig,
  setFallbackConfig,
  showToast,
}: UseModelFallbackConfigArgs) {
  const [syncingFallback, setSyncingFallback] = useState(false);
  const [fallbackConfigSaving, setFallbackConfigSaving] = useState(false);
  const [fallbackConfigDirty, setFallbackConfigDirty] = useState(false);
  const [fallbackConfigError, setFallbackConfigError] = useState<string | null>(null);
  const fallbackSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackSaveGenRef = useRef(0);
  const pendingFallbackConfigRef = useRef<FallbackConfig | null>(null);

  const persistFallbackConfigNow = useCallback(
    async (config: FallbackConfig): Promise<boolean> => {
      const gen = ++fallbackSaveGenRef.current;
      setFallbackConfigSaving(true);
      setFallbackConfigError(null);
      // The route returns `{ data: { config: ... } }` (envelope).
      // `safeApiCall<T>` does NOT unwrap — `data` is the full body —
      // so the type is the envelope shape and the inner config is read
      // via `res?.data?.config` (two indirections).
      const { ok, data: res, error } = await safeApiCall<{ data?: { config: FallbackConfig } }>(
        "/api/models/fallbacks/config",
        {
          method: "PUT",
          body: {
            restorePrimaryOnFallback: config.restorePrimaryOnFallback,
            fallbackNotification: config.fallbackNotification,
            apiMaxRetries: config.apiMaxRetries,
          },
        },
      );
      if (gen !== fallbackSaveGenRef.current) {
        return false;
      }
      setFallbackConfigSaving(false);
      const saved = res?.data?.config;
      if (!ok || !saved) {
        setFallbackConfigError(error ?? "Failed to save fallback settings");
        return false;
      }
      setFallbackConfig(saved);
      setFallbackConfigDirty(false);
      return true;
    },
    [setFallbackConfig],
  );

  const handleFallbackConfigChange = useCallback(
    (next: FallbackConfig) => {
      setFallbackConfig(next);
      setFallbackConfigDirty(true);
      setFallbackConfigError(null);
      pendingFallbackConfigRef.current = next;

      if (fallbackSaveTimerRef.current) {
        clearTimeout(fallbackSaveTimerRef.current);
      }
      fallbackSaveTimerRef.current = setTimeout(() => {
        const toSave = pendingFallbackConfigRef.current;
        if (!toSave) return;
        void persistFallbackConfigNow(toSave);
      }, 400);
    },
    [persistFallbackConfigNow, setFallbackConfig],
  );

  const flushFallbackConfigSave = useCallback(async (): Promise<boolean> => {
    if (fallbackSaveTimerRef.current) {
      clearTimeout(fallbackSaveTimerRef.current);
      fallbackSaveTimerRef.current = null;
    }
    const pending = pendingFallbackConfigRef.current ?? fallbackConfig;
    if (!fallbackConfigDirty && !fallbackConfigSaving) {
      return true;
    }
    return persistFallbackConfigNow(pending);
  }, [fallbackConfig, fallbackConfigDirty, fallbackConfigSaving, persistFallbackConfigNow]);

  /**
   * Push the fallback settings to Hermes. The pending autosave is flushed
   * first, so what is synced is what is on screen; the answer carries the
   * config Hermes now holds, which becomes the screen's, and is checked
   * against the retry threshold that was asked for.
   */
  const handleSyncFallbackToHermes = useCallback(async () => {
    const expectedRetries = fallbackConfig.apiMaxRetries;
    setSyncingFallback(true);
    const saved = await flushFallbackConfigSave();
    if (!saved) {
      setSyncingFallback(false);
      showToast(fallbackConfigError ?? "Save fallback settings before syncing", "error");
      return;
    }
    await runWrite<{ data?: { success?: boolean; config?: FallbackConfig } }>({
      setBusy: setSyncingFallback,
      showToast,
      url: "/api/models/fallbacks",
      body: { action: "sync", config: fallbackConfig },
      successMessage: (res) => {
        const retries = res?.data?.config?.apiMaxRetries;
        return retries !== undefined && retries !== expectedRetries
          ? { message: `Sync finished but retry threshold is still ${retries} (expected ${expectedRetries})`, type: "error" }
          : "Fallback config synced to Hermes";
      },
      errorMessage: "Sync failed",
      onSuccess: (res) => {
        const config = res?.data?.config;
        if (config) {
          setFallbackConfig(config);
          setFallbackConfigDirty(false);
        }
      },
    });
  }, [fallbackConfig, fallbackConfigError, flushFallbackConfigSave, showToast, setFallbackConfig]);

  return {
    syncingFallback,
    fallbackConfigSaving,
    fallbackConfigDirty,
    fallbackConfigError,
    handleFallbackConfigChange,
    handleSyncFallbackToHermes,
  };
}
