// ═══════════════════════════════════════════════════════════════
// llm-judge.ts — an INDEPENDENT model grading another model's work (CORE)
//
// Lifted out of src/lib/benchmarks/score-judge.ts ahead of that subsystem being
// deleted. What survives is the part that is hard to get right: calibration
// anchors that mean the same thing across runs, explicit penalties for
// fabrication and verbosity, and a strict parse contract that THROWS rather than
// silently scoring zero when the judge does not answer in the required shape.
//
// One thing deliberately did NOT survive. score-judge defaulted its grader to
// `getDefaultModel("agent")`, so unless an operator had configured a separate
// judge the model graded its own output. That is the exact bias the rubric was
// designed to remove, and it silently applied to 14 of the suite's items. Here
// the judge model is REQUIRED: there is no fallback, and `judgeModelId` is not
// optional. A caller with nothing configured gets an error, not a flattering
// score.
//
// NOT yet wired into Composer. Composer gates its workflows on the actor's own
// `VERDICT: PASS` (see composer/verdict.ts), which is the same self-grading bias
// sitting in the product's real path -- a stage agent reporting on its own work.
// Replacing that with a second opinion changes how every existing workflow
// routes, so it is an owner decision rather than a refactor, and it is recorded
// as one in org/decisions/ADR-0004.
// ═══════════════════════════════════════════════════════════════

import { callLLM } from "@/lib/llm";
import { stripReasoning, extractAnswerSpan } from "@/lib/llm-output";

export interface JudgeRequest {
  /** What the work was supposed to achieve. */
  task: string;
  /** The rubric. What "good" means, in the caller's own terms. */
  criteria: string;
  /** The output being graded. */
  response: string;
  /** Optional ideal answer to compare against. */
  reference?: string;
  /**
   * The grading model. REQUIRED, and deliberately so: an omitted judge is how
   * the benchmark subsystem ended up letting models grade themselves.
   */
  judgeModelId: string;
  /** Score at or above which the work passes. Defaults to 0.75. */
  passThreshold?: number;
}

export interface JudgeVerdict {
  score: number;
  passed: boolean;
  reason?: string;
}

/** Build the rubric prompt. Exported so its wording can be tested directly. */
export function buildJudgePrompt(req: JudgeRequest): string {
  return [
    "You are a STRICT, fair evaluator. Score the RESPONSE against the CRITERIA on a 0..1 scale.",
    'Reply with ONLY a JSON object: {"score": <number 0..1>, "pass": <true|false>, "reason": "<one short sentence>"}.',
    "Calibration anchors:",
    "- 1.00 fully meets every criterion; accurate, complete, well-judged.",
    "- 0.75 meets the core requirement with a minor gap or omission.",
    "- 0.50 partially correct: a real flaw, missing piece, or notable vagueness.",
    "- 0.25 mostly wrong but contains a relevant fragment.",
    "- 0.00 fails the task, is inaccurate, fabricates facts/citations, or ignores the instruction.",
    "Penalise fabrication, unsupported claims, vagueness, and over-/under-refusal. Do NOT reward verbosity.",
    "",
    `TASK:\n${req.task}`,
    req.reference ? `\nREFERENCE (an ideal answer):\n${req.reference}` : "",
    `\nCRITERIA:\n${req.criteria}`,
    `\nRESPONSE TO SCORE:\n${req.response}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function tryParseJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.search(/[[{]/);
  if (start === -1) return undefined;
  try {
    return JSON.parse(body.slice(start));
  } catch {
    return undefined;
  }
}

/** Parse a judge reply. Returns null when the reply is not a usable score. */
export function parseJudgeReply(raw: string): { score: number; pass?: boolean; reason?: string } | null {
  const parsed = tryParseJson(raw) as { score?: unknown; pass?: unknown; reason?: unknown } | undefined;
  if (!parsed || typeof parsed.score !== "number" || !Number.isFinite(parsed.score)) return null;
  return {
    score: Math.max(0, Math.min(1, parsed.score)),
    pass: typeof parsed.pass === "boolean" ? parsed.pass : undefined,
    reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
  };
}

/**
 * Grade one piece of work with an independent model.
 *
 * THROWS when the judge does not return a parseable score. That is deliberate:
 * an unparseable reply means the grade is unknown, and treating unknown as zero
 * is how a working system gets reported as broken. The caller decides whether an
 * ungraded item is an error or a retry.
 */
export async function judge(req: JudgeRequest): Promise<JudgeVerdict> {
  const cleaned = stripReasoning(req.response);
  const answer = extractAnswerSpan(cleaned) ?? cleaned;
  if (!answer.trim()) {
    return { score: 0, passed: false, reason: "empty response" };
  }
  const resp = await callLLM([{ role: "user", content: buildJudgePrompt({ ...req, response: answer }) }], {
    modelId: req.judgeModelId,
    temperature: 0,
    maxTokens: 256,
  });
  const verdict = parseJudgeReply(resp.content);
  if (!verdict) {
    throw new Error("judge returned no parseable score");
  }
  const threshold = req.passThreshold ?? 0.75;
  return {
    score: verdict.score,
    passed: verdict.pass ?? verdict.score >= threshold,
    reason: verdict.reason,
  };
}
