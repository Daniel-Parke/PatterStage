// ═══════════════════════════════════════════════════════════════
// usage-shape.ts — the one place that reads a provider's token counts
//
// WHY THIS EXISTS. Three vocabularies reach this codebase for the same three
// numbers:
//
//   OpenAI-compatible   { prompt_tokens, completion_tokens, total_tokens }
//   Anthropic           { input_tokens,  output_tokens }
//   internal            { promptTokens,  completionTokens, totalTokens }
//
// Deep Research recorded NULL tokens on every run for as long as the feature has
// existed, because `llm.ts` assigned the provider's object straight into a field
// declared in the third vocabulary and the accumulator read camelCase off a
// snake_case object (T-0068). No type could catch it: `Response.json()` is
// `Promise<any>`, so the assignment is unchecked, and every annotation in the
// chain was individually correct.
//
// THE RULE OF THREE IS MET, which is why this is a module rather than a fourth
// inline conversion. `HermesRuntime.mapUsage` was the first, the Anthropic
// branch in `llm.ts` was the second, and the gateway and direct-OpenAI paths
// needed a third and fourth. The repo's own convention (see api-response.ts's
// header) is to extract at three.
//
// ABSENT IS NOT ZERO, and that distinction is the whole point of the spend
// console's unmeasured reporting: a run nobody priced must not appear as a
// measured $0.00. So this returns `undefined` when the provider said nothing,
// and never invents zeroes to make a shape line up.
// ═══════════════════════════════════════════════════════════════

/** Token counts in the internal vocabulary. */
export interface NormalisedUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

function num(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

/**
 * Read a provider's usage object in whichever vocabulary it used.
 *
 * Returns `undefined` when there is nothing to read: no object, or an object
 * carrying neither an input nor an output count. A total alone is not enough to
 * price a run, and reporting `{0, 0, n}` would be a fabrication.
 */
export function normaliseUsage(raw: unknown): NormalisedUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;

  const prompt = num(o.promptTokens) ?? num(o.prompt_tokens) ?? num(o.input_tokens);
  const completion = num(o.completionTokens) ?? num(o.completion_tokens) ?? num(o.output_tokens);
  if (prompt === undefined && completion === undefined) return undefined;

  const promptTokens = prompt ?? 0;
  const completionTokens = completion ?? 0;
  // A provider that gives a total is believed over the sum, because some bill
  // for tokens neither counter covers (cached reads, reasoning tokens).
  const totalTokens =
    num(o.totalTokens) ?? num(o.total_tokens) ?? promptTokens + completionTokens;

  return { promptTokens, completionTokens, totalTokens };
}
