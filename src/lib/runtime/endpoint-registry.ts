// ═══════════════════════════════════════════════════════════════
// runtime/endpoint-registry.ts — profile -> gateway endpoint resolution
//
// A Hermes gateway serves exactly one profile. This registry is the ONE place
// that maps a profile name to a concrete {baseUrl, apiKey}. Every profile now
// resolves to the single configured default gateway (getAgentGateway, in
// gateway.ts).
//
// It used to carry an exception: ephemeral `__bench_<runId>` profiles were routed
// to their own short-lived gateway, spawned per benchmark run on a dedicated
// port. That was the ONLY reason this file needed per-profile branching at all,
// and it went with the benchmark subsystem (org/decisions/ADR-0004). The 353-line spawner
// behind it had no other caller.
//
// Worth knowing before adding a branch back: if a second framework or a
// multi-profile gateway needs distinct endpoints per profile, this is the right
// place, but it should resolve from configuration rather than from a live process
// table. The deleted version read a `bench_gateways` row written by a subprocess
// it had spawned, which made endpoint resolution depend on process liveness.
// ═══════════════════════════════════════════════════════════════

import { getAgentGateway } from "./gateway";
import { getGatewayKey } from "./secrets";

const DEFAULT_PROFILE = "default";

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
  const { baseUrl } = getAgentGateway();
  return { profileName: name, baseUrl, apiKey: getGatewayKey(name) };
}
