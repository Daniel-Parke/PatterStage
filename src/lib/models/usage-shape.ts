// ═══════════════════════════════════════════════════════════════
// usage-shape.ts — the one place that reads a provider's token counts
//
// Three vocabularies for the same numbers: OpenAI-compatible (prompt_tokens,
// completion_tokens, total_tokens), Anthropic (input_tokens, output_tokens),
// internal (promptTokens, completionTokens, totalTokens). Deep Research
// recorded NULL tokens on every run because `llm.ts` assigned the provider's
// object into a field of the third and the accumulator read camelCase off
// snake_case (T-0068); `Response.json()` is `Promise<any>`, so no type caught it.
//
// ABSENT IS NOT ZERO: a run nobody priced must not appear as a measured $0.00,
// so this returns `undefined` when the provider said nothing and never invents zeroes.
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
 * Read a provider's usage object in whichever vocabulary it used. `undefined`
 * when there is nothing to read: a total alone cannot price a run, and
 * reporting `{0, 0, n}` would be a fabrication.
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
