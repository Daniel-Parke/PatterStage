// ═══════════════════════════════════════════════════════════════
// llm.ts — Configurable LLM endpoint for Story Weaver and other
// agent-agnostic LLM calls made by PatterStage.
// ═══════════════════════════════════════════════════════════════

import { getAgentGateway } from "./runtime/gateway";
import { normaliseUsage } from "./usage-shape";
import { getModelWithKey, type ModelWithKey } from "./models-repository";
import { getGatewayKey } from "./runtime/secrets";
import { buildDirectRequest, inferApiStyle, type ApiStyle } from "./llm-endpoint";

/**
 * Fast-fail timeout for the direct-provider path. A misconfigured endpoint
 * (wrong baseUrl / api_style) should surface in seconds, not hang the UI for
 * minutes — the resilient gateway path keeps its own longer retry budget.
 */
const DIRECT_PROVIDER_TIMEOUT_MS = 45_000;

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  /** Free-form model string passed to the gateway when modelId is not set. */
  model?: string;
  /**
   * Registry model id. When provided, the model's `base_url` and joined
   * credential decide whether to call the provider directly or fall through
   * to the Hermes Gateway path.
   */
  modelId?: string;
  /**
   * Override the direct-provider fast-fail timeout (ms). Interactive callers
   * keep the snappy 45s default; benchmark brain-only runs pass the agent's
   * per-item budget (~120s) so a slow provider isn't unfairly timed out —
   * the agentic path gets that budget via the gateway, so the baseline must
   * get it too for a fair comparison.
   */
  timeoutMs?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Thrown when the Hermes Gateway is unreachable.
 * Provides a user-facing message with actionable steps.
 */
class GatewayUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GatewayUnavailableError";
  }
}

/**
 * Probe the gateway health endpoint. Throws GatewayUnavailableError
 * with a descriptive message if the gateway is not responding.
 */
async function probeGatewayHealth(): Promise<void> {
  const { baseUrl } = getAgentGateway();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(baseUrl + "/health", {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      throw new GatewayUnavailableError(
        "Hermes Gateway is not running. Story Weaver needs it for AI generation. " +
          "Please ensure Hermes is started with API_SERVER_ENABLED=true in the agent .env, " +
          "then restart the gateway."
      );
    }
  } catch (err) {
    if (err instanceof GatewayUnavailableError) throw err;
    // Network failure or AbortError — gateway is unreachable
    throw new GatewayUnavailableError(
      "Hermes Gateway is not running. Story Weaver needs it for AI generation. " +
        "Please ensure Hermes is started with API_SERVER_ENABLED=true in the agent .env, " +
        "then restart the gateway."
    );
  }
}

/**
 * Call the configured LLM endpoint with retry and timeout.
 *
 * Resolution order:
 *   1. `opts.modelId` set + the registry row carries a `baseUrl` and joined
 *      API key → call that provider directly with `Authorization: Bearer`.
 *   2. `opts.modelId` set without `baseUrl` → use the registry's `modelId`
 *      string as the gateway model name and fall through to the Hermes
 *      Gateway path.
 *   3. Otherwise → use `opts.model` (or "hermes") with the gateway.
 */
export async function callLLM(
  messages: LLMMessage[],
  opts: LLMOptions = {}
): Promise<LLMResponse> {
  const {
    temperature = 0.8,
    maxTokens = 4096,
    model: optModel,
    modelId,
    timeoutMs,
  } = opts;

  let resolved: ModelWithKey | null = null;
  if (modelId) {
    try {
      resolved = getModelWithKey(modelId);
    } catch {
      resolved = null;
    }
  }

  // ── Direct-provider path ──────────────────────────────────
  if (resolved && resolved.baseUrl && resolved.apiKey) {
    return callDirectProvider({
      messages,
      temperature,
      maxTokens,
      model: resolved.modelId,
      baseUrl: resolved.baseUrl,
      apiKey: resolved.apiKey,
      apiStyle: resolved.apiStyle ?? inferApiStyle(resolved.provider, resolved.baseUrl),
      timeoutMs,
    });
  }

  // ── Gateway path ──────────────────────────────────────────
  const gatewayModel =
    resolved?.modelId ?? optModel ?? "hermes";

  const { chatCompletionsUrl: apiUrl } = getAgentGateway();

  await probeGatewayHealth();
  return callGateway({
    messages,
    temperature,
    maxTokens,
    model: gatewayModel,
    apiUrl,
  });
}

interface CallParams {
  messages: LLMMessage[];
  temperature: number;
  maxTokens: number;
  model: string;
}

interface CallGatewayInput extends CallParams {
  apiUrl: string;
}

interface CallDirectInput extends CallParams {
  baseUrl: string;
  apiKey: string;
  apiStyle: ApiStyle;
  /** Optional fast-fail override (ms); defaults to DIRECT_PROVIDER_TIMEOUT_MS. */
  timeoutMs?: number;
}

async function callDirectProvider(input: CallDirectInput): Promise<LLMResponse> {
  const req = buildDirectRequest({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    model: input.model,
    messages: input.messages,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    style: input.apiStyle,
  });

  const timeoutMs = input.timeoutMs ?? DIRECT_PROVIDER_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let resp: Response;
    try {
      resp = await fetch(req.url, {
        method: "POST",
        headers: req.headers,
        body: req.body,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(
          `LLM provider timed out after ${Math.round(timeoutMs / 1000)}s — ` +
            `check the model's base URL / API style (endpoint / registry config).`
        );
      }
      throw err;
    }

    if (!resp.ok) {
      const detail = (await resp.text().catch(() => "")).trim();
      throw new Error(
        `LLM provider error ${resp.status}: ${detail ? detail.slice(0, 200) : resp.statusText}`
      );
    }

    const data = await resp.json();

    // Anthropic-style: { content: [{ text }], usage: { input_tokens, output_tokens } }
    if (input.apiStyle === "anthropic") {
      const blocks = Array.isArray(data?.content) ? (data.content as { text?: string }[]) : [];
      const content = blocks.map((b) => b?.text ?? "").join("").trim();
      // This branch was the only one that normalised, because an explicit cast
      // forced its author to name the wire shape. It now shares the one
      // normaliser rather than keeping a private copy of the same knowledge.
      const usage = normaliseUsage(data?.usage);
      return { content, model: data?.model ?? input.model, usage };
    }

    // OpenAI-compatible: { choices: [{ message: { content } }], usage }
    return {
      content: data.choices?.[0]?.message?.content?.trim() ?? "",
      model: data.model ?? input.model,
      usage: normaliseUsage(data.usage),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callGateway(input: CallGatewayInput): Promise<LLMResponse> {
  const apiUrl = input.apiUrl;
  const model = input.model;
  const temperature = input.temperature;
  const maxTokens = input.maxTokens;
  const messages = input.messages;

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300_000); // 5 min

    try {
      const gatewayKey = getGatewayKey();
      const resp = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // The Hermes API Server requires a bearer key when API_SERVER_KEY is
          // set; without this every gateway call 401s once auth is enabled.
          ...(gatewayKey ? { Authorization: `Bearer ${gatewayKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (resp.status === 429) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 30_000 * attempt));
          continue;
        }
        throw new Error("Rate limit — please wait a minute and try again.");
      }

      if (!resp.ok) {
        throw new Error(`LLM API error: ${resp.status} ${resp.statusText}`);
      }

      const data = await resp.json();
      const content =
        data.choices?.[0]?.message?.content?.trim() ?? "";

      if (!content && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 5_000 * attempt));
        continue;
      }

      return {
        content,
        model: data.model ?? model,
        // Through the normaliser, not straight through. `data` is `any` (
        // Response.json() is typed Promise<any>), so assigning the provider's
        // snake_case object into this camelCase field type-checked cleanly and
        // silently zeroed every Deep Research run (T-0068).
        usage: normaliseUsage(data.usage),
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError") {
        // Retry on timeout — treat it like any other retryable error
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 3_000 * attempt));
          continue;
        }
      }
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 3_000 * attempt));
      }
    }
  }

  throw lastError ?? new Error("LLM call failed after retries");
}
