// ═══════════════════════════════════════════════════════════════
// llm-output.ts — reading a model's FINAL answer, not its working (CORE)
//
// Lifted out of src/lib/benchmarks/score.ts, where these primitives were built
// because a grader that scores a model's deliberation instead of its conclusion
// reports a false zero. The same failure mode exists in the product's real path
// and was live: Composer's parseVerdict matched `VERDICT:` against the raw
// output, so a reasoning model that weighed "VERDICT: PASS" inside <think> while
// concluding FAIL routed on_pass and the run reported success.
//
// Composer's verdict regex had already been hardened once against the model
// echoing its own instruction template, so this class of defect has bitten here
// before. Reasoning blocks are the same problem one layer out: text that looks
// like an answer but is not one.
// ═══════════════════════════════════════════════════════════════

/**
 * Chain-of-thought wrappers models emit before their real answer.
 *
 * The backreference `\1` requires the closing tag to match the opening one, so
 * `<think>…</reflection>` is not treated as a block. Non-greedy so two separate
 * blocks do not swallow the answer between them.
 */
const REASONING_BLOCK = /<(think|thinking|reasoning|scratchpad|reflection)>[\s\S]*?<\/\1>/gi;

/**
 * Strip reasoning/CoT wrappers so a reader sees the FINAL answer, not the
 * model's working.
 *
 * Deliberately does NOT handle an unclosed `<think>` with no terminator: that is
 * a truncated response, and silently discarding everything after the opening tag
 * would turn a truncation into an empty answer. Callers that need to detect that
 * should check for a dangling tag themselves.
 */
export function stripReasoning(s: string): string {
  return s.replace(REASONING_BLOCK, " ").replace(/\s+\n/g, "\n").trim();
}

/**
 * If the output explicitly marks its final answer, return just that span. Covers
 * `<answer>…</answer>`, "Final answer: …", "Answer: …". Returns null when no
 * marker is present, so the caller can fall back to the whole stripped output.
 */
export function extractAnswerSpan(s: string): string | null {
  const tag = s.match(/<answer>\s*([\s\S]*?)\s*<\/answer>/i);
  if (tag) return tag[1].trim() || null;
  const marker = s.match(/(?:final\s+answer|answer)\s*[:\-]\s*([\s\S]+)/i);
  if (marker) return marker[1].trim() || null;
  return null;
}
