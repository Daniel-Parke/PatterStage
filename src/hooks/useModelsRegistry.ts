// ═══════════════════════════════════════════════════════════════
// useModelsRegistry — the one read of /config/models
// ═══════════════════════════════════════════════════════════════
//
// Split out of useModelsPage (Phase 4 god-file decomposition). Owns
// every slice `loadAll` writes — models, credentials, task defaults,
// sync drift, the fallback chain and the fallback config — plus the
// page-level loading/error pair and the two option lists the pickers
// render from.
//
// `loadAll` is the single refetch every write path on this page calls
// after it succeeds, so it is defined here, where the setters it
// writes through live, and passed down to the action hooks. The
// fallback slices' own state (dirty/saving/error/busy flags) stays in
// useModelFallbackChain and useModelFallbackConfig; only the two values
// `loadAll` populates are held here, with `setFallbackConfig` handed
// back so the debounced save can write through it.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { API_FETCH_BULK_TIMEOUT_MS, safeApiCallData, apiFetch, messageFromError, setErrorFromCaught } from "@/lib/api-fetch";
import type { DefaultsModelOption } from "@/components/models/DefaultsGrid";
import { type TaskType } from "@/lib/models/task-types";
import type { FallbackChainEntry, FallbackConfig } from "@/types/console";
import { emptyModelDefaults } from "@/lib/utils";

import type { ApiCredential, ApiModel, SyncDrift } from "@/components/models/types";

export function useModelsRegistry() {
  const [models, setModels] = useState<ApiModel[]>([]);
  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [defaults, setDefaults] = useState<Record<TaskType, string | null>>(
    emptyModelDefaults()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drift, setDrift] = useState<SyncDrift | null>(null);

  const [fallbackChain, setFallbackChain] = useState<FallbackChainEntry[]>([]);
  const [fallbackConfig, setFallbackConfig] = useState<FallbackConfig>({
    restorePrimaryOnFallback: true,
    fallbackNotification: false,
    apiMaxRetries: 3,
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // First, sync models from ~/.hermes/config.yaml — ensures we show
      // live data even if the user changed defaults externally via hermes CLI
      await apiFetch("/api/models/import", {
        method: "POST",
        // Bulk: walks the whole catalogue (T-0047).
        timeoutMs: API_FETCH_BULK_TIMEOUT_MS,
      }).catch((err) => {
        // `messageFromError` falls back to `String(err)` when the caught
        // value has no `message` — equivalent to the verbose
        // `toError(err).message || String(err)` form, with a name + JSDoc.
        const msg = messageFromError(err, String(err));
        console.warn("Model auto-import failed — showing cached data:", msg);
      });

      const [m, c, d, drift, fb, fbCfg] = await Promise.all([
        apiFetch("/api/models"),
        apiFetch("/api/credentials"),
        apiFetch("/api/models/defaults"),
        // Best-effort reads — fall back to `null` on per-endpoint error
        // instead of failing the whole load. The first three (m/c/d)
        // are still throw-on-error so the outer catch can show
        // "Failed to load registry" if a primary endpoint is down.
        safeApiCallData<SyncDrift>("/api/models/sync/drift"),
        safeApiCallData<{ entries?: FallbackChainEntry[] }>("/api/models/fallbacks"),
        safeApiCallData<{ config?: FallbackConfig }>("/api/models/fallbacks/config"),
      ]);

      setModels(m.data?.models ?? []);
      setCredentials(c.data?.credentials ?? []);
      // API returns a complete defaults object (all 12 slots populated or null).
      // Fall back to empty defaults if the response is missing.
      setDefaults(d.data?.defaults ?? emptyModelDefaults());

      if (drift) {
        setDrift(drift);
      }

      if (fb?.entries) {
        setFallbackChain(fb.entries);
      }

      if (fbCfg?.config) {
        setFallbackConfig(fbCfg.config);
      }
    } catch (err) {
      setErrorFromCaught(setError, err, "Failed to load registry");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const modelOptions = useMemo<DefaultsModelOption[]>(
    () =>
      models.map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        modelId: m.modelId,
      })),
    [models]
  );

  const credentialOptions = useMemo(
    () =>
      credentials.map((c) => ({
        id: c.id,
        label: c.label,
        provider: c.provider,
        keyHint: c.keyHint,
      })),
    [credentials]
  );

  return {
    models,
    credentials,
    modelOptions,
    credentialOptions,
    defaults,
    setDefaults,
    loading,
    error,
    drift,
    fallbackChain,
    fallbackConfig,
    setFallbackConfig,
    loadAll,
  };
}
