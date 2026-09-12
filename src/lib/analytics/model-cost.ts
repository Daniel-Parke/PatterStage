// ═══════════════════════════════════════════════════════════════
// analytics/model-cost.ts — static $/token table + cost estimation.
//
// Pure + dependency-free so the Insights "estimated spend" metric is
// unit-testable. Prices are USD per 1M tokens, matched by a normalised
// substring of the model id (provider-agnostic). Unknown models fall back
// to a conservative default so spend is never silently zero.
//
// ── THE TABLE IS SMALL, AND THE PRODUCT HAS TO SAY SO ──────────
//
// This table knows fifteen model families. There are hundreds, and an install
// running one of the others (MiniMax, for instance) gets DEFAULT_RATE for every
// figure it sees. That is the right arithmetic: a made-up price would be worse
// than a declared fallback, because it would be wrong AND believed.
//
// What was NOT right was the silence. Nothing downstream could tell a priced
// figure from a guessed one, so the console told the operator its numbers came
// from published rates when, on that install, not one of them did. So pricing
// reports its BASIS as well as its number: `estimateCostWithBasis` says whether
// the rate came off this table or off the fallback, and the spend window and
// panel carry that answer all the way to the screen.
//
// Adding a rate here is welcome. Guessing one is not: leave a model out and its
// cost is honestly an estimate, put a wrong number in and it is quietly a lie.
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

/** A rate, plus where it came from. */
interface ResolvedRate extends ModelRate {
  /** False means DEFAULT_RATE: the figure below it is a guess, not a price. */
  known: boolean;
}

function resolveRate(modelId: string | null | undefined): ResolvedRate {
  if (!modelId) return { ...DEFAULT_RATE, known: false };
  const id = modelId.toLowerCase();
  const keys = Object.keys(RATES).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (id.includes(k)) return { ...RATES[k], known: true };
  }
  return { ...DEFAULT_RATE, known: false };
}

/** Resolve a model id (e.g. "anthropic/claude-sonnet-4") to a rate. */
export function rateForModel(modelId: string | null | undefined): ModelRate {
  const { input, output } = resolveRate(modelId);
  return { input, output };
}

/** An estimated cost that can say how much of a guess it is. */
export interface CostEstimate {
  usd: number;
  /**
   * True when the price came off the rate table. False when it came off
   * DEFAULT_RATE, which covers every model this table has never heard of and
   * every run that recorded no model at all.
   */
  fromKnownRate: boolean;
}

/**
 * Estimated USD cost for a token split, WITH its basis.
 *
 * One call rather than a cost call plus a separate rate lookup, so the money
 * and the claim made about the money cannot come from different rows.
 */
export function estimateCostWithBasis(
  modelId: string | null | undefined,
  inputTokens: number,
  outputTokens: number,
): CostEstimate {
  const r = resolveRate(modelId);
  return {
    usd:
      (Math.max(0, inputTokens) / 1_000_000) * r.input +
      (Math.max(0, outputTokens) / 1_000_000) * r.output,
    fromKnownRate: r.known,
  };
}

/** Estimated USD cost for a token split on a given model. */
export function estimateCost(
  modelId: string | null | undefined,
  inputTokens: number,
  outputTokens: number,
): number {
  return estimateCostWithBasis(modelId, inputTokens, outputTokens).usd;
}
