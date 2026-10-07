// ═══════════════════════════════════════════════════════════════
// runtime/gateway.ts — where the agent answers, framework-neutrally
//
// The third and last piece of the port. AgentRuntime covers what the agent
// DOES; AgentWorkspace covers where its files ARE; AgentGateway covers where
// its inference endpoint IS.
//
// Four core sites called getAgentLlmEndpoints() from modules/hermes/lib/agent-runtime to
// get a URL, and not one of them used any Hermes knowledge beyond that URL —
// an OpenAI-compatible chat endpoint is the most framework-neutral thing in
// the whole system. It counted against the framework-agnostic claim purely
// because of which file the constant lived in (org/decisions/ADR-0005).
//
// Core depends on THIS; only this file knows the answer comes from Hermes.
// ═══════════════════════════════════════════════════════════════

import { getAgentLlmEndpoints } from "@/modules/hermes/lib/agent-runtime";

/** The agent's inference gateway. */
export interface AgentGateway {
  /** Gateway base URL, never with a trailing slash. Health and model listing hang off this. */
  baseUrl: string;
  /** OpenAI-compatible chat-completions endpoint. */
  chatCompletionsUrl: string;
}

/**
 * The active agent's gateway.
 *
 * Resolves through the Hermes endpoint config today. When a second framework
 * lands, this is the one function that consults the framework registry, and
 * nothing above it changes.
 *
 * For per-profile routing — including the ephemeral benchmark gateways — use
 * `resolveEndpoint()` in `endpoint-registry.ts`, which layers profile
 * resolution on top of this default.
 */
export function getAgentGateway(): AgentGateway {
  const { apiUrl, gatewayBase } = getAgentLlmEndpoints();
  return {
    baseUrl: gatewayBase.replace(/\/+$/, ""),
    chatCompletionsUrl: apiUrl,
  };
}
