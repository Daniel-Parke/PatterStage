// ═══════════════════════════════════════════════════════════════
// runtime/endpoint-registry.ts — profile -> gateway endpoint resolution
//
// A Hermes gateway serves exactly one profile. This registry is the ONE place
// that maps a profile name to a concrete {baseUrl, apiKey}. Most profiles
// resolve to the single configured default gateway (env / getAgentLlmEndpoints).
// EXCEPTION: ephemeral benchmark profiles (__bench_<runId>) get their own
// short-lived gateway spawned by the benchmark gateway manager on a dedicated
// port/key — so an agentic benchmark actually exercises the toggled config. When
// such a gateway is live for the profile, route there; otherwise fall back.
// ═══════════════════════════════════════════════════════════════

import { getAgentLlmEndpoints } from "@/lib/hermes-agent-runtime";
import { getGatewayKey } from "./secrets";
import { getBenchGatewayEndpoint } from "./gateway-manager";

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

  // A live ephemeral benchmark gateway short-circuits to its own port/key so the
  // run hits the toggled config, not the shared default agent.
  const bench = getBenchGatewayEndpoint(name);
  if (bench) {
    return { profileName: name, baseUrl: bench.baseUrl.replace(/\/+$/, ""), apiKey: bench.apiKey };
  }

  const { gatewayBase } = getAgentLlmEndpoints();
  const baseUrl = gatewayBase.replace(/\/+$/, "");
  return { profileName: name, baseUrl, apiKey: getGatewayKey(name) };
}
