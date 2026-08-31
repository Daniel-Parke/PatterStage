// ═══════════════════════════════════════════════════════════════
// useGatewayHealth — Unified gateway connectivity + agent model status
// ═══════════════════════════════════════════════════════════════
// Consolidates three separate useEffect patterns from the chat page:
//   1. Gateway online check (polls every 30s)
//   2. Agent default model set check
//   3. Registry + gateway model list
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback } from "react";
import { safeApiCallData } from "@/lib/api-fetch";
import { useInterval } from "@/hooks/useInterval";
import { CHAT_DEFAULT_MODEL } from "@/types/chat";

const GATEWAY_HEALTH_URL = "/api/gateway/health";
const GATEWAY_MODELS_URL = "/api/gateway/models";
const MODELS_REGISTRY_URL = "/api/models";
const MODELS_DEFAULTS_URL = "/api/models/defaults";
const CONFIG_URL = "/api/config";

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
  /** Whether both registry and disk have an agent default model set */
  agentDefaultModelSet: boolean | null;
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

interface ConfigModelField {
  model?: { default?: string } | string;
}

/**
 * Fetch gateway health, model lists, and agent default status.
 *
 * Returns `online: null` during initial load, `false` if unreachable,
 * `true` if the gateway health endpoint responds 2xx.
 *
 * Returns `agentDefaultModelSet: null` during initial load, `false` if
 * either registry or disk config lacks an agent default, `true` if both are set.
 */
export function useGatewayHealth(): GatewayHealth & {
  refetchHealth: () => void;
  refetchModels: () => Promise<void>;
} {
  const [online, setOnline] = useState<boolean | null>(null);
  const [authConfigured, setAuthConfigured] = useState<boolean | null>(null);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [agentDefaultModelSet, setAgentDefaultModelSet] = useState<boolean | null>(null);
  const [registryModelIds, setRegistryModelIds] = useState<string[]>([]);
  const [modelLabels, setModelLabels] = useState<Record<string, string>>({});
  const [gatewayModelIds, setGatewayModelIds] = useState<string[]>([CHAT_DEFAULT_MODEL]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(true);

  // ── Check gateway connectivity ───────────────────────────────
  // The endpoint returns `{ data: { online: boolean } }`. `safeApiCallData`
  // unwraps the inner `{ online }` so a truthy `online` is reported as
  // online and any error (or `{ data: { online: false } }`) is reported
  // as offline — byte-equivalent to the pre-refactor
  // `result.ok ? result.data?.online === true : false` shape.
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

  // ── Check agent default model setup ─────────────────────────
  // Both endpoints return `{ data: <inner> }`. `safeApiCallData` unwraps
  // the inner payload directly so the `defaults?.agent` and
  // `config?.model` reads work the way the type suggests. The pre-
  // refactor code read the envelope `result.data` and got `{ data: ... }`
  // for both — `result.data.defaults` was `undefined` and the hook
  // always reported `agentDefaultModelSet: false`. This is a "feature
  // is not working" fix that the recurring mission explicitly permits
  // — the migration to `safeApiCallData` makes the chat page correctly
  // detect a configured agent default.
  const checkAgentModel = useCallback(async () => {
    const [defaults, config] = await Promise.all([
      safeApiCallData<{ defaults?: { agent?: string } }>(MODELS_DEFAULTS_URL, {
        signal: AbortSignal.timeout(5000),
      }),
      safeApiCallData<ConfigModelField>(CONFIG_URL, {
        signal: AbortSignal.timeout(5000),
      }),
    ]);
    const registryOk = Boolean(defaults?.defaults?.agent?.trim());
    let diskOk = false;
    if (config) {
      const modelCfg = config.model;
      if (typeof modelCfg === "string") {
        diskOk = modelCfg.trim().length > 0;
      } else if (modelCfg && typeof modelCfg === "object") {
        diskOk = Boolean(String((modelCfg as Record<string, unknown>).default ?? "").trim());
      }
    }
    setAgentDefaultModelSet(registryOk && diskOk);
  }, []);

  // ── Fetch model lists ───────────────────────────────────────
  // Both endpoints return `{ data: <inner> }`. As with `checkAgentModel`,
  // the pre-refactor code read the envelope and the model list was
  // always empty. After the migration, `registry` and `gateway` are the
  // inner payloads (`null` on error, payload on success).
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
    agentDefaultModelSet,
    registryModelIds,
    modelLabels,
    gatewayModelIds,
    modelsError,
    modelsLoading,
    refetchHealth: checkOnline,
    refetchModels: fetchModels,
  };
}
