// ═══════════════════════════════════════════════════════════════
// hermes-agent-runtime.ts — Active Hermes install + paths
// ═══════════════════════════════════════════════════════════════

import { homedir } from "os";
import { getHermesEntry } from "./agent-registry";
import type { HermesRegistryEntry } from "./agent-registry";
import { buildHermesPathBundle, type HermesPathBundle } from "./hermes-paths";

export type { HermesPathBundle };

/** Resolved paths for the local Hermes install. */
export function getActiveHermesPaths(): HermesPathBundle {
  const root = getHermesEntry().filesystemRoot || process.env.AGENT_HOME || process.env.HERMES_HOME || homedir() + "/.hermes";
  return buildHermesPathBundle(String(root).trim() || homedir() + "/.hermes");
}

/** Active Hermes filesystem root (alias for paths.root). */
export function getActiveHermesHome(): string {
  return getActiveHermesPaths().root;
}

export function getHermesEntryOrThrow(): HermesRegistryEntry {
  const e = getHermesEntry();
  if (!e) {
    throw new Error("No Hermes entry in registry");
  }
  return e;
}

const DEFAULT_GATEWAY = "http://127.0.0.1:8642";

/**
 * LLM chat URL and gateway base for health probes — from the Hermes entry, then env, then default.
 */
export function getAgentLlmEndpoints(): { apiUrl: string; gatewayBase: string } {
  const entry = getHermesEntry();
  const envApi = process.env.CONTROL_HUB_LLM_API?.trim();
  const envGateway =
    envApi && envApi.includes("/v1/chat/completions")
      ? envApi.replace(/\/v1\/chat\/completions\/?$/, "")
      : undefined;

  let gatewayBase = DEFAULT_GATEWAY;
  if (entry?.gatewayBaseUrl?.trim()) {
    gatewayBase = entry.gatewayBaseUrl.trim().replace(/\/$/, "");
  } else if (envGateway) {
    gatewayBase = envGateway.replace(/\/$/, "");
  }

  let apiUrl = gatewayBase + "/v1/chat/completions";
  if (entry?.llmBaseUrl?.trim()) {
    apiUrl = entry.llmBaseUrl.trim();
    if (!entry.gatewayBaseUrl?.trim() && apiUrl.includes("/v1/chat/completions")) {
      gatewayBase = apiUrl.replace(/\/v1\/chat\/completions\/?$/, "").replace(/\/$/, "");
    }
  } else if (envApi) {
    apiUrl = envApi;
  }

  return { apiUrl, gatewayBase };
}
