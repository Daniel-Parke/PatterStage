// ═══════════════════════════════════════════════════════════════
// llm-endpoint.ts — direct-provider endpoint + protocol helpers
//
// PatterStage's `callLLM` direct path talks to a provider's HTTP API without
// the Hermes gateway. Providers expose one of two wire protocols:
//   • OpenAI-compatible  → POST {base}/chat/completions, `messages`, `choices[]`
//   • Anthropic-compatible → POST {base}/v1/messages, hoisted `system`, `content[]`
//
// The bug this fixes: the old code blindly appended `/chat/completions` to any
// baseUrl, so an Anthropic-style base like `https://api.minimax.io/anthropic`
// became `…/anthropic/chat/completions` → 404. These helpers pick the right
// path + request shape from an explicit `api_style`, and never double-append a
// path the baseUrl already carries. Pure + dependency-free so the migration
// repair and unit tests can reuse `inferApiStyle`.
// ═══════════════════════════════════════════════════════════════

export type ApiStyle = "openai" | "anthropic";

interface EndpointMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Best-effort protocol guess when a model row has no explicit `api_style`.
 * An `/anthropic` base path (e.g. MiniMax's Anthropic-compatible endpoint) or
 * the `anthropic` provider ⇒ the Anthropic protocol; everything else defaults
 * to OpenAI-compatible. Mirrors the SQL repair in the v24 migration.
 */
export function inferApiStyle(
  provider: string | null | undefined,
  baseUrl: string | null | undefined,
): ApiStyle {
  const base = (baseUrl ?? "").toLowerCase().replace(/\/+$/, "");
  if (/\/anthropic$/.test(base) || base.includes("/anthropic/")) return "anthropic";
  if ((provider ?? "").toLowerCase() === "anthropic") return "anthropic";
  return "openai";
}

/** Normalise a stored `api_style` value to a known protocol, or null. */
export function normalizeApiStyle(value: string | null | undefined): ApiStyle | null {
  return value === "openai" || value === "anthropic" ? value : null;
}

/**
 * Build the request URL for a direct provider call. Does not double-append a
 * path the baseUrl already ends with (so `…/v1/messages`, `…/chat/completions`
 * pass through unchanged), and adds the canonical suffix otherwise.
 */
export function buildDirectUrl(baseUrl: string, style: ApiStyle): string {
  const base = baseUrl.replace(/\/+$/, "");
  if (style === "anthropic") {
    if (/\/v\d+\/messages$/.test(base) || /\/messages$/.test(base)) return base;
    if (/\/v\d+$/.test(base)) return `${base}/messages`;
    return `${base}/v1/messages`; // e.g. `…/anthropic` → `…/anthropic/v1/messages`
  }
  // OpenAI-compatible. Conservative: only avoid a double `/chat/completions`;
  // otherwise preserve the historical "append /chat/completions" behaviour so
  // existing `…/v1` bases keep resolving to `…/v1/chat/completions`.
  if (/\/chat\/completions$/.test(base)) return base;
  return `${base}/chat/completions`;
}

export interface DirectRequest {
  url: string;
  headers: Record<string, string>;
  /** JSON-serialised request body. */
  body: string;
}

export interface BuildDirectRequestInput {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: EndpointMessage[];
  temperature: number;
  maxTokens: number;
  style: ApiStyle;
}

/**
 * Construct the URL + headers + body for a direct provider call. Anthropic
 * hoists `system` messages out of the array and authenticates with `x-api-key`
 * + `anthropic-version`; OpenAI keeps the messages intact and uses a Bearer
 * token. Pure (no fetch) so it is straightforward to unit-test.
 */
export function buildDirectRequest(input: BuildDirectRequestInput): DirectRequest {
  const url = buildDirectUrl(input.baseUrl, input.style);

  if (input.style === "anthropic") {
    const system = input.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n")
      .trim();
    const messages = input.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const body: Record<string, unknown> = {
      model: input.model,
      max_tokens: input.maxTokens,
      temperature: input.temperature,
      messages,
    };
    if (system) body.system = system;

    return {
      url,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    };
  }

  return {
    url,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      temperature: input.temperature,
      max_tokens: input.maxTokens,
    }),
  };
}
