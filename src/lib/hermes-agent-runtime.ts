// ═══════════════════════════════════════════════════════════════
// hermes-agent-runtime.ts — Active Hermes install + paths
// ═══════════════════════════════════════════════════════════════

import { homedir } from "os";
import { getHermesHome } from "./hermes-home";
import { buildHermesPathBundle, type HermesPathBundle } from "./hermes-paths";

export type { HermesPathBundle };

/** Resolved paths for the local Hermes install. */
export function getActiveHermesPaths(): HermesPathBundle {
  const root = getHermesHome() || process.env.AGENT_HOME || process.env.HERMES_HOME || homedir() + "/.hermes";
  return buildHermesPathBundle(String(root).trim() || homedir() + "/.hermes");
}

/** Active Hermes filesystem root (alias for paths.root). */
export function getActiveHermesHome(): string {
  return getActiveHermesPaths().root;
}

/** Returns the Hermes home directory or throws if not configured. */
export function getHermesHomeOrThrow(): string {
  const home = getHermesHome();
  if (!home) {
    throw new Error("No Hermes install found — set HERMES_HOME or AGENT_HOME");
  }
  return home;
}

const DEFAULT_GATEWAY = "http://127.0.0.1:8642";

/**
 * LLM chat URL and gateway base for health probes — from env or default config.
 */
export function getAgentLlmEndpoints(): { apiUrl: string; gatewayBase: string } {
  const envApi = process.env.CONTROL_HUB_LLM_API?.trim();
  const envGateway =
    envApi && envApi.includes("/v1/chat/completions")
      ? envApi.replace(/\/v1\/chat\/completions\/?$/, "")
      : undefined;

  const envGatewayUrl = process.env.HERMES_GATEWAY_URL?.trim();

  let gatewayBase = DEFAULT_GATEWAY;
  if (envGatewayUrl) {
    gatewayBase = envGatewayUrl.replace(/\/$/, "");
  } else if (envGateway) {
    gatewayBase = envGateway.replace(/\/$/, "");
  }

  let apiUrl = gatewayBase + "/v1/chat/completions";
  if (envApi) {
    apiUrl = envApi;
    if (!envGateway && apiUrl.includes("/v1/chat/completions")) {
      gatewayBase = apiUrl.replace(/\/v1\/chat\/completions\/?$/, "").replace(/\/$/, "");
    }
  }

  return { apiUrl, gatewayBase };
}
