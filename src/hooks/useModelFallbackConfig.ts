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
import { safeApiCall, apiFetch, toastError } from "@/lib/api-fetch";
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

  const handleSyncFallbackToHermes = useCallback(async () => {
    setSyncingFallback(true);
    try {
      const expectedRetries = fallbackConfig.apiMaxRetries;
      const saved = await flushFallbackConfigSave();
      if (!saved) {
        showToast(fallbackConfigError ?? "Save fallback settings before syncing", "error");
        return;
      }

      const res = await apiFetch<{
        data: {
          success: boolean;
          config: FallbackConfig;
          configPath?: string;
        };
      }>("/api/models/fallbacks", {
        method: "POST",
        body: JSON.stringify({ action: "sync", config: fallbackConfig }),
      });

      const payload = res.data;
      if (!payload?.success) {
        showToast("Sync failed", "error");
        return;
      }

      if (payload.config) {
        setFallbackConfig(payload.config);
        setFallbackConfigDirty(false);
      }

      if (payload.config.apiMaxRetries !== expectedRetries) {
        showToast(
          `Sync finished but retry threshold is still ${payload.config.apiMaxRetries} (expected ${expectedRetries})`,
          "error",
        );
        return;
      }

      showToast("Fallback config synced to Hermes", "success");
    } catch (err) {
      toastError(showToast, err, "Sync failed");
    } finally {
      setSyncingFallback(false);
    }
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
