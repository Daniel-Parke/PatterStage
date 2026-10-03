// ═══════════════════════════════════════════════════════════════
// deep-research/usage.ts — totalling what the model reported, honestly.
//
// A Deep Research run makes several LLM calls and its spend is their sum, which
// until T-0030 was never taken: `defaultLlm` dropped `LLMResponse.usage`. Three
// states, not two: counted, recorded as zero (a real measurement), and never
// recorded, which is NOT zero. That is why `accumulateUsage` returns null for
// an empty input: a run with no usage has an unknown cost, and collapsing it to
// zero would paint a real cost as free, the hole T-0030 closed, one layer down.
// ═══════════════════════════════════════════════════════════════

/** Token counts as a provider reports them. */
export interface ResearchUsage {
  promptTokens: number;
  completionTokens: number;
  /** Providers usually send this; derived from the other two when they do not. */
  totalTokens?: number;
}

/** A usage total, with `totalTokens` always present. */
export interface ResearchUsageTotal {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** A count we can add up, or null if it is not one. */
function finite(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * Total every call's usage. Null when NOT ONE call reported usable counts,
 * which the caller persists as NULL, not 0; a silent hop is skipped and the
 * others still count. A non-finite count is treated as absent: NaN beside real
 * money survives every downstream check, the budget comparison included.
 */
export function accumulateUsage(
  calls: Array<ResearchUsage | undefined | null>,
): ResearchUsageTotal | null {
  let prompt = 0;
  let completion = 0;
  let total = 0;
  let sawAny = false;

  for (const call of calls) {
    if (!call) continue;
    const p = finite(call.promptTokens);
    const c = finite(call.completionTokens);
    if (p === null && c === null) continue;
    sawAny = true;
    prompt += p ?? 0;
    completion += c ?? 0;
    // The provider's own total is preferred: it can exceed prompt+completion
    // (reasoning tokens, cached reads billed separately).
    const t = finite(call.totalTokens);
    total += t ?? (p ?? 0) + (c ?? 0);
  }

  return sawAny ? { promptTokens: prompt, completionTokens: completion, totalTokens: total } : null;
}
