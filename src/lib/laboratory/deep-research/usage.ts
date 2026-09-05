// ═══════════════════════════════════════════════════════════════
// deep-research/usage.ts — totalling what the model reported, honestly.
//
// A Deep Research run makes several LLM calls: one to plan, one to reason per
// round, one to synthesize. Its spend is the sum of them, and until T-0030 that
// sum was never taken: `defaultLlm` returned `{ content }` and dropped
// `LLMResponse.usage` on the floor.
//
// THE DISTINCTION THIS MODULE EXISTS TO KEEP. There are three states, not two:
//
//   counted            the provider reported counts; add them to the total
//   recorded as zero   the provider reported zero; that is a real measurement
//   never recorded     nobody reported anything; this is NOT zero
//
// The third is why `accumulateUsage` returns null rather than a zeroed object
// for an empty input. A run with no usage is a run whose cost is unknown, and
// the spend console must be able to say so. Collapsing it to zero would take a
// real, uncounted cost and paint it as free, which is exactly the hole T-0030
// was filed to close, moved one layer down where it is harder to see.
// spend-summary.ts already argues the same point against itself in a comment.
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
 * Total the usage of every call in a run.
 *
 * Returns null when NOT ONE call reported usable counts, which the caller must
 * persist as NULL rather than as 0. Calls that reported nothing are skipped;
 * calls that reported something are counted, so a run where one provider hop
 * stayed silent still contributes what the others measured.
 *
 * A non-finite count is treated as absent rather than added. NaN in a spend
 * figure is worse than a missing one: it renders as "NaN" beside real money and
 * survives every arithmetic check downstream, including the budget comparison.
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
    // Prefer the provider's own total, which can legitimately exceed
    // prompt+completion (reasoning tokens, cached reads billed separately).
    const t = finite(call.totalTokens);
    total += t ?? (p ?? 0) + (c ?? 0);
  }

  return sawAny ? { promptTokens: prompt, completionTokens: completion, totalTokens: total } : null;
}
