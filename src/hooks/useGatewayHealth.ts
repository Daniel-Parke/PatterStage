// ═══════════════════════════════════════════════════════════════
// useGatewayHealth — Unified gateway connectivity + agent model status
// ═══════════════════════════════════════════════════════════════
// Three reads: the gateway online check (polled every 30s), whether the
// agent has a model at all, and the registry + gateway model lists. All of
// them through useApiResource (T-0129), so the registry read is the same
// cache entry the models page and the mission composer read.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback, useMemo } from "react";

import { useApiResource } from "@/hooks/useApiResource";
import type { ModelReadiness } from "@/lib/models/model-readiness";
import { CHAT_DEFAULT_MODEL } from "@/types/chat";

const GATEWAY_HEALTH_URL = "/api/gateway/health";
const GATEWAY_MODELS_URL = "/api/gateway/models";
const MODELS_REGISTRY_URL = "/api/models";
const MODELS_DEFAULTS_URL = "/api/models/defaults";

export interface GatewayHealth {
  /** Whether the Hermes Gateway is reachable */
  online: boolean | null;
  /**
   * Whether PatterStage can authenticate to the gateway. `false` means the
   * gateway is reachable but rejected our bearer key (missing/wrong
   * API_SERVER_KEY); `null` during initial load.
   */
  authConfigured: boolean | null;
  /**
   * WHICH gateway was probed, e.g. `http://127.0.0.1:8652`. `null` until the
   * first probe answers. The offline banner names it rather than guessing a
   * port (T-0080).
   */
  baseUrl: string | null;
  /**
   * The product's one answer to "do I have a model?", as resolved by
   * GET /api/models/defaults. `null` during initial load and when the read
   * fails: not knowing is not the same as knowing there is none, and a banner
   * raised on a failed read would accuse a working install.
   */
  modelReadiness: ModelReadiness | null;
  /** Model IDs from the registry catalog */
  registryModelIds: string[];
  /** Human-readable name map for registry models */
  modelLabels: Record<string, string>;
  /** Model IDs available from the gateway */
  gatewayModelIds: string[];
  /** Whether model list loading encountered an error */
  modelsError: string | null;
  /** Whether the model list is currently being fetched */
  modelsLoading: boolean;
}

interface RegistryModelRecord {
  modelId: string;
  name: string;
}

interface HealthAnswer {
  online: boolean;
  authConfigured?: boolean;
  baseUrl?: string;
}

/**
 * Fetch gateway health, model lists, and agent default status.
 *
 * Returns `online: null` during initial load, `false` if unreachable,
 * `true` if the gateway health endpoint responds 2xx.
 *
 * Returns `modelReadiness: null` until the models endpoint answers.
 */
export function useGatewayHealth(): GatewayHealth & {
  refetchHealth: () => void;
  refetchModels: () => Promise<void>;
} {
  // ── Check gateway connectivity ───────────────────────────────
  // The endpoint returns `{ data: { online: boolean } }`, and any error
  // reports as offline. Polled every 30s; react-query stops the poll while
  // the tab is hidden and catches up on focus, as useInterval did before it:
  // a background tab was probing the gateway 2,880 times a day to update a
  // dot nobody was looking at, and the value the operator actually cares
  // about is the one on screen when they return.
  const health = useApiResource<HealthAnswer>(GATEWAY_HEALTH_URL, {
    select: (p) => (p as HealthAnswer | null) ?? undefined,
    errorMessage: "Gateway unreachable",
    refetchInterval: 30_000,
  });
  // A probe that failed keeps the last answer's address: the gateway did not
  // move because the browser lost the tab's connection, and blanking it would
  // drop the banner back to a guess.
  const online = health.error ? false : health.data ? health.data.online === true : null;
  const authConfigured = online ? health.data?.authConfigured !== false : null;
  const baseUrl = typeof health.data?.baseUrl === "string" && health.data.baseUrl ? health.data.baseUrl : null;

  // ── Does the agent have a model? ────────────────────────────
  //
  // ONE read, and no arithmetic on the answer. This used to fetch the models
  // registry AND the agent's config file and report `registryOk && diskOk`,
  // and the registry half is irrelevant to chat: an agent turn sends no model
  // (the gateway reads its own config file) and a fast turn sends the chat
  // dropdown's id. An install whose config file named a model but whose
  // registry slot was empty was therefore told, in orange, that it could not
  // chat, on a chat that worked. The rule now lives in one place on the server
  // (src/lib/models/model-readiness.ts, applied by GET /api/models/defaults)
  // so this screen and the two others read the same answer.
  const readiness = useApiResource<ModelReadiness | null>(MODELS_DEFAULTS_URL, {
    select: (p) => (p as { modelReadiness?: ModelReadiness } | null)?.modelReadiness ?? null,
    errorMessage: "Failed to read the agent's model",
  });
  const modelReadiness = readiness.data ?? null;

  // ── Fetch model lists ───────────────────────────────────────
  // Both endpoints return `{ data: <inner> }` and the reader selects the
  // inner list. Reading the envelope instead left the model list always empty.
  const registry = useApiResource<RegistryModelRecord[]>(MODELS_REGISTRY_URL, {
    select: (p) => {
      const models = (p as { models?: RegistryModelRecord[] } | null)?.models;
      return Array.isArray(models) ? models : [];
    },
    errorMessage: "Failed to load the model registry",
  });
  const gateway = useApiResource<string[]>(GATEWAY_MODELS_URL, {
    select: (p) => (p as { models?: string[] } | null)?.models ?? [],
    errorMessage: "Gateway models unavailable",
  });

  const registryModelIds = useMemo(
    () =>
      (registry.data ?? [])
        .map((m) => m.modelId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    [registry.data],
  );
  const modelLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const m of registry.data ?? []) {
      if (m.modelId) labels[m.modelId] = m.name;
    }
    return labels;
  }, [registry.data]);
  const gatewayModelIds = useMemo(
    () => (gateway.data && gateway.data.length > 0 ? gateway.data : [CHAT_DEFAULT_MODEL]),
    [gateway.data],
  );
  const modelsError = gateway.error ? "Gateway models unavailable" : null;
  const modelsLoading = registry.isFetching || gateway.isFetching;

  const { refetch: refetchHealthQuery } = health;
  const refetchHealth = useCallback(() => {
    void refetchHealthQuery();
  }, [refetchHealthQuery]);

  const { refetch: refetchRegistry } = registry;
  const { refetch: refetchGateway } = gateway;
  const refetchModels = useCallback(async () => {
    await Promise.all([refetchRegistry(), refetchGateway()]);
  }, [refetchRegistry, refetchGateway]);

  return {
    online,
    authConfigured,
    baseUrl,
    modelReadiness,
    registryModelIds,
    modelLabels,
    gatewayModelIds,
    modelsError,
    modelsLoading,
    refetchHealth,
    refetchModels,
  };
}
