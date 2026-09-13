// ═══════════════════════════════════════════════════════════════
// useModelsRegistry — the one read of /config/models
// ═══════════════════════════════════════════════════════════════
//
// Owns every slice the page reads — models, credentials, task defaults,
// sync drift, the fallback chain and the fallback config — plus the
// page-level loading/error pair and the two option lists the pickers
// render from.
//
// Six reads through useApiResource (T-0129), so the registry and the
// defaults are the cache entries the chat and the mission composer already
// share. `loadAll` is the single refetch every write path on this page
// calls after it succeeds: it re-reads all six. The fallback slices' own
// state (dirty/saving/error/busy flags) stays in useModelFallbackChain and
// useModelFallbackConfig; the two values a write edits ahead of the server
// (`defaults`, `fallbackConfig`) are held here as state the reads seed, with
// their setters handed back so the debounced save can write through them.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useApiResource } from "@/hooks/useApiResource";
import type { DefaultsModelOption } from "@/components/models/DefaultsGrid";
import { type TaskType } from "@/lib/models/task-types";
import type { ModelReadiness } from "@/lib/models/model-readiness";
import type { FallbackChainEntry, FallbackConfig } from "@/types/console";
import { emptyModelDefaults } from "@/lib/utils";

import type { ApiCredential, ApiModel, SyncDrift } from "@/components/models/types";

interface DefaultsAnswer {
  defaults?: Record<TaskType, string | null>;
  modelReadiness?: ModelReadiness;
}

const REGISTRY_ERROR = "Failed to load registry";

export function useModelsRegistry() {
  // A READ, and only a read. This used to import config.yaml first, so
  // every page load and every post-mutation reload wrote to the registry:
  // a rename saved a moment earlier was overwritten by the reload that
  // followed it, and a cleared default came straight back (T-0100, D9/D10).
  // Re-importing is an act the operator asks for now, on the header button.
  const modelsRead = useApiResource<ApiModel[]>("/api/models", {
    select: (p) => (p as { models?: ApiModel[] } | null)?.models ?? [],
    errorMessage: REGISTRY_ERROR,
  });
  const credentialsRead = useApiResource<ApiCredential[]>("/api/credentials", {
    select: (p) => (p as { credentials?: ApiCredential[] } | null)?.credentials ?? [],
    errorMessage: REGISTRY_ERROR,
  });
  const defaultsRead = useApiResource<DefaultsAnswer>("/api/models/defaults", {
    select: (p) => (p as DefaultsAnswer | null) ?? undefined,
    errorMessage: REGISTRY_ERROR,
  });
  // Best-effort reads: a failure here is `null`, not the page's error. The
  // three above are the primary endpoints, and any one of them down is
  // "Failed to load registry".
  const driftRead = useApiResource<SyncDrift | null>("/api/models/sync/drift", {
    select: (p) => (p as SyncDrift | null) ?? null,
  });
  const chainRead = useApiResource<FallbackChainEntry[] | null>("/api/models/fallbacks", {
    select: (p) => (p as { entries?: FallbackChainEntry[] } | null)?.entries ?? null,
  });
  const configRead = useApiResource<FallbackConfig | null>("/api/models/fallbacks/config", {
    select: (p) => (p as { config?: FallbackConfig } | null)?.config ?? null,
  });

  const models = useMemo(() => modelsRead.data ?? [], [modelsRead.data]);
  const credentials = useMemo(() => credentialsRead.data ?? [], [credentialsRead.data]);
  // The product's one answer to "do I have a model?", read from the same
  // response the slot uuids come in. Null until the first read lands.
  const modelReadiness = defaultsRead.data?.modelReadiness ?? null;
  const drift = driftRead.data ?? null;
  const fallbackChain = useMemo(() => chainRead.data ?? [], [chainRead.data]);

  // API returns a complete defaults object (all 12 slots populated or null).
  // Fall back to empty defaults if the response is missing.
  const [defaults, setDefaults] = useState<Record<TaskType, string | null>>(
    emptyModelDefaults()
  );
  useEffect(() => {
    if (defaultsRead.data) setDefaults(defaultsRead.data.defaults ?? emptyModelDefaults());
  }, [defaultsRead.data]);

  const [fallbackConfig, setFallbackConfig] = useState<FallbackConfig>({
    restorePrimaryOnFallback: true,
    fallbackNotification: false,
    apiMaxRetries: 3,
  });
  useEffect(() => {
    if (configRead.data) setFallbackConfig(configRead.data);
  }, [configRead.data]);

  // `loading` is true again on every reload; a page keeps what it has on
  // screen through those and shows the spinner only before `settled`, which
  // is true once the first read has answered, whatever it said.
  const loading = modelsRead.isFetching || credentialsRead.isFetching || defaultsRead.isFetching;
  const settled = modelsRead.settled && credentialsRead.settled && defaultsRead.settled;
  const error = modelsRead.error ?? credentialsRead.error ?? defaultsRead.error;

  const { refetch: refetchModels } = modelsRead;
  const { refetch: refetchCredentials } = credentialsRead;
  const { refetch: refetchDefaults } = defaultsRead;
  const { refetch: refetchDrift } = driftRead;
  const { refetch: refetchChain } = chainRead;
  const { refetch: refetchConfig } = configRead;
  const loadAll = useCallback(async () => {
    await Promise.all([
      refetchModels(),
      refetchCredentials(),
      refetchDefaults(),
      refetchDrift(),
      refetchChain(),
      refetchConfig(),
    ]);
  }, [refetchModels, refetchCredentials, refetchDefaults, refetchDrift, refetchChain, refetchConfig]);

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
    modelReadiness,
    loading,
    settled,
    error,
    drift,
    fallbackChain,
    fallbackConfig,
    setFallbackConfig,
    loadAll,
  };
}
