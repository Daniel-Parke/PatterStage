// ═══════════════════════════════════════════════════════════════
// runtime/endpoint-registry.ts — profile -> gateway endpoint resolution
//
// Each Hermes profile runs as its own `hermes -p <name> gateway` process on
// its own host/port/key. This registry is the ONE place that maps a profile
// name to a concrete {baseUrl, apiKey}. Phase 1 resolves every profile to the
// single configured default gateway (env / getAgentLlmEndpoints). Phase 2
// layers per-profile resolution from agent_profiles.{gateway_host,
// gateway_port, api_key_ref}, so distinct profiles can target distinct ports.
// ═══════════════════════════════════════════════════════════════

import { getAgentLlmEndpoints } from "@/lib/hermes-agent-runtime";
import { getGatewayKey } from "./secrets";

export const DEFAULT_PROFILE = "default";

export interface RuntimeEndpoint {
  profileName: string;
  /** Gateway base URL, no trailing slash (e.g. http://127.0.0.1:8642). */
  baseUrl: string;
  /** Bearer key, or null when none is configured. */
  apiKey: string | null;
}

/** Resolve the gateway endpoint that serves the given profile. */
export function resolveEndpoint(profileName?: string): RuntimeEndpoint {
  const name = profileName?.trim() || DEFAULT_PROFILE;

  // Phase 2 seam: look up agent_profiles.{gateway_host,gateway_port,api_key_ref}
  // here and short-circuit before falling back to the default gateway.

  const { gatewayBase } = getAgentLlmEndpoints();
  const baseUrl = gatewayBase.replace(/\/+$/, "");
  return { profileName: name, baseUrl, apiKey: getGatewayKey(name) };
}
