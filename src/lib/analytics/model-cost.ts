// ═══════════════════════════════════════════════════════════════
// analytics/model-cost.ts — static $/token table + cost estimation.
//
// Pure + dependency-free so the Insights "estimated spend" metric is
// unit-testable. Prices are USD per 1M tokens, matched by a normalised
// substring of the model id (provider-agnostic). Unknown models fall back
// to a conservative default so spend is never silently zero.
// ═══════════════════════════════════════════════════════════════

export interface ModelRate {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
}

/** Substring → rate. First match (longest key first) wins. USD / 1M tokens. */
const RATES: Record<string, ModelRate> = {
  "claude-opus": { input: 15, output: 75 },
  "claude-sonnet": { input: 3, output: 15 },
  "claude-haiku": { input: 0.8, output: 4 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4": { input: 10, output: 30 },
  "o1": { input: 15, output: 60 },
  "o3": { input: 2, output: 8 },
  "gemini-1.5-pro": { input: 1.25, output: 5 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "gemini": { input: 0.5, output: 1.5 },
  "deepseek": { input: 0.27, output: 1.1 },
  "llama": { input: 0.2, output: 0.2 },
  "mistral": { input: 0.4, output: 2 },
  "qwen": { input: 0.3, output: 1.2 },
};

/** Conservative fallback when a model id matches no known rate. */
export const DEFAULT_RATE: ModelRate = { input: 1, output: 3 };

/** Resolve a model id (e.g. "anthropic/claude-sonnet-4") to a rate. */
export function rateForModel(modelId: string | null | undefined): ModelRate {
  if (!modelId) return DEFAULT_RATE;
  const id = modelId.toLowerCase();
  const keys = Object.keys(RATES).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (id.includes(k)) return RATES[k];
  }
  return DEFAULT_RATE;
}

/** Estimated USD cost for a token split on a given model. */
export function estimateCost(
  modelId: string | null | undefined,
  inputTokens: number,
  outputTokens: number,
): number {
  const r = rateForModel(modelId);
  return (
    (Math.max(0, inputTokens) / 1_000_000) * r.input +
    (Math.max(0, outputTokens) / 1_000_000) * r.output
  );
}
