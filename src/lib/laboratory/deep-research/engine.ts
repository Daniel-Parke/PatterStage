// ═══════════════════════════════════════════════════════════════
// laboratory/deep-research/engine.ts — the research orchestrator
//
// MVP single-pass loop: plan → (optional) search → synthesize. Inference goes
// through an injectable LlmFn (default = callLLM, so it's provider-flexible:
// local endpoint or cloud, defaulting to the Hermes agent's model). Search,
// LLM, and step persistence are all injected so the engine is pure + testable.
// The full IterResearch/ReAct loop (iterate, visit pages, compact context,
// optional python) is the next phase — this lays the seam.
// ═══════════════════════════════════════════════════════════════

import { callLLM, type LLMMessage } from "@/lib/llm";
import type { ResearchStepKind, SearchProvider, SearchResult } from "./types";

const PLAN_SYSTEM =
  "You are a meticulous research strategist. Given a question, produce a short, " +
  "concrete research plan: the key sub-questions to answer and what evidence " +
  "would settle each. Be specific. Output a tight bulleted plan, no preamble.";

const SYNTHESIZE_SYSTEM =
  "You are a rigorous research analyst. Using the plan and any provided sources, " +
  "write a clear, well-structured report that answers the question. Cite sources " +
  "as [n] inline when you use them. State uncertainty honestly. If there are no " +
  "external sources, answer from your own knowledge and say so. Output Markdown.";

export type LlmFn = (
  messages: LLMMessage[],
  opts: { modelId?: string; temperature?: number; maxTokens?: number },
) => Promise<{ content: string }>;

export interface ResearchStepRecord {
  kind: ResearchStepKind;
  input: string | null;
  output: string | null;
  sources: string[];
}

export interface DeepResearchDeps {
  llm: LlmFn;
  search: SearchProvider;
  /** Called for each completed step (persist + stream to the UI). */
  onStep: (step: ResearchStepRecord) => void;
  /** Registry model id, or undefined = Hermes default (callLLM resolves it). */
  modelId?: string;
}

export interface DeepResearchResult {
  report: string;
  /** Search backend that ran (e.g. "none" for LLM-only). */
  provider: string;
}

/** Minimal single-pass research: plan → optional search → synthesize. */
export async function runDeepResearch(
  query: string,
  deps: DeepResearchDeps,
): Promise<DeepResearchResult> {
  const modelId = deps.modelId;

  // 1. Plan
  const plan = await deps.llm(
    [
      { role: "system", content: PLAN_SYSTEM },
      { role: "user", content: query },
    ],
    { modelId, temperature: 0.4, maxTokens: 800 },
  );
  deps.onStep({ kind: "plan", input: query, output: plan.content, sources: [] });

  // 2. Search (optional — the null provider returns [])
  let results: SearchResult[] = [];
  try {
    results = await deps.search.search(query, 6);
  } catch {
    results = [];
  }
  if (results.length > 0) {
    deps.onStep({
      kind: "search",
      input: query,
      output: results.map((r) => `${r.title} — ${r.url}`).join("\n"),
      sources: results.map((r) => r.url),
    });
  }

  // 3. Synthesize
  const sourceBlock =
    results.length > 0
      ? results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join("\n\n")
      : "(no external sources — answer from model knowledge)";
  const synth = await deps.llm(
    [
      { role: "system", content: SYNTHESIZE_SYSTEM },
      {
        role: "user",
        content: `Research question:\n${query}\n\nResearch plan:\n${plan.content}\n\nSources:\n${sourceBlock}`,
      },
    ],
    { modelId, temperature: 0.5, maxTokens: 2000 },
  );
  deps.onStep({
    kind: "synthesize",
    input: sourceBlock,
    output: synth.content,
    sources: results.map((r) => r.url),
  });

  return { report: synth.content, provider: deps.search.name };
}

/** The real inference fn — callLLM, so local/cloud/Hermes-default all work. */
export const defaultLlm: LlmFn = async (messages, opts) => {
  const res = await callLLM(messages, opts);
  return { content: res.content };
};
