// ═══════════════════════════════════════════════════════════════
// useGatewayHealth — Unified gateway connectivity + agent model status
// ═══════════════════════════════════════════════════════════════
// Three reads: the gateway online check (polled every 30s), whether the
// agent has a model at all, and the registry + gateway model lists.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback } from "react";
import { safeApiCallData } from "@/lib/api-fetch";
import { useInterval } from "@/hooks/useInterval";
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
  const [online, setOnline] = useState<boolean | null>(null);
  const [authConfigured, setAuthConfigured] = useState<boolean | null>(null);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [modelReadiness, setModelReadiness] = useState<ModelReadiness | null>(null);
  const [registryModelIds, setRegistryModelIds] = useState<string[]>([]);
  const [modelLabels, setModelLabels] = useState<Record<string, string>>({});
  const [gatewayModelIds, setGatewayModelIds] = useState<string[]>([CHAT_DEFAULT_MODEL]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(true);

  // ── Check gateway connectivity ───────────────────────────────
  // The endpoint returns `{ data: { online: boolean } }`; `safeApiCallData`
  // unwraps the inner `{ online }`, and any error reports as offline.
  const checkOnline = useCallback(async () => {
    const data = await safeApiCallData<{
      online: boolean;
      authConfigured?: boolean;
      baseUrl?: string;
    }>(GATEWAY_HEALTH_URL, { signal: AbortSignal.timeout(3000) });
    setOnline(data?.online === true);
    // Only meaningful when reachable; null when the probe failed entirely.
    setAuthConfigured(data?.online === true ? data?.authConfigured !== false : null);
    // Kept from the last answer when a probe fails to reach OUR OWN server:
    // the gateway address did not change because the browser lost the tab's
    // connection, and blanking it would drop the banner back to a guess.
    if (typeof data?.baseUrl === "string" && data.baseUrl) setBaseUrl(data.baseUrl);
  }, []);

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
  const checkAgentModel = useCallback(async () => {
    const defaults = await safeApiCallData<{ modelReadiness?: ModelReadiness }>(
      MODELS_DEFAULTS_URL,
      { signal: AbortSignal.timeout(5000) },
    );
    setModelReadiness(defaults?.modelReadiness ?? null);
  }, []);

  // ── Fetch model lists ───────────────────────────────────────
  // Both endpoints return `{ data: <inner> }`; `registry` and `gateway` are
  // the inner payloads (`null` on error). Reading the envelope instead left
  // the model list always empty.
  const fetchModels = useCallback(async () => {
    setModelsError(null);
    setModelsLoading(true);
    const labels: Record<string, string> = {};
    let registryIds: string[] = [];
    let gateway: string[] = [CHAT_DEFAULT_MODEL];

    const [registry, gatewayRes] = await Promise.all([
      safeApiCallData<{ models?: RegistryModelRecord[] }>(MODELS_REGISTRY_URL),
      safeApiCallData<{ models?: string[] }>(GATEWAY_MODELS_URL, {
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    if (registry && Array.isArray(registry.models)) {
      const records = registry.models;
      registryIds = records
        .map((m) => m.modelId)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      for (const m of records) {
        if (m.modelId) labels[m.modelId] = m.name;
      }
    }

    if (gatewayRes) {
      const ids: string[] = gatewayRes.models || [];
      if (ids.length > 0) gateway = ids;
    } else {
      setModelsError("Gateway models unavailable");
    }

    setRegistryModelIds(registryIds);
    setGatewayModelIds(gateway);
    setModelLabels(labels);
    setModelsLoading(false);
  }, []);

  // ── Initial load ────────────────────────────────────────────
  useEffect(() => {
    void checkOnline();
    void checkAgentModel();
    void fetchModels();
  }, [checkOnline, checkAgentModel, fetchModels]);

  // ── Poll gateway health every 30s ───────────────────────────
  //
  // Via `useInterval` rather than a raw `setInterval`, so the poll stops while
  // the chat tab is hidden and re-checks once the moment it comes back. A
  // background tab was probing the gateway 2,880 times a day to update a dot
  // nobody was looking at, and the value the operator actually cares about is
  // the one on screen when they return.
  useInterval(() => {
    void checkOnline();
  }, { ms: 30_000 });

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
    refetchHealth: checkOnline,
    refetchModels: fetchModels,
  };
}
