// ═══════════════════════════════════════════════════════════════
// laboratory/deep-research/engine.ts — the iterative research orchestrator
//
// IterResearch loop: plan → (search → visit top sources → reason)×rounds →
// synthesize, under a round budget, persisting every step. Inference goes
// through an injectable LlmFn (default = callLLM → provider-flexible: local
// endpoint or cloud, defaulting to the Hermes model). Search, visit, llm, and
// step persistence are all injected so the engine is pure + testable.
// ═══════════════════════════════════════════════════════════════

import { callLLM, type LLMMessage } from "@/lib/llm";
import { visitPage } from "@/lib/search";
import type { ResearchStepKind, SearchProvider, SearchResult, VisitedPage } from "./types";

const PLAN_SYSTEM =
  "You are a meticulous research strategist. Given a question, produce a short, " +
  "concrete research plan: the key sub-questions and what evidence settles each. " +
  "End with a single good initial web search query on a line `QUERY: <query>`.";

const REASON_SYSTEM =
  "You are a rigorous research analyst. Given the question, plan, the evidence " +
  "gathered this round, and prior notes, write what we now know and what is still " +
  "missing. If more searching is needed, end with `NEXT QUERY: <query>`; if the " +
  "question is sufficiently answered, end with `DONE`.";

const SYNTHESIZE_SYSTEM =
  "You are a rigorous research analyst. Using the plan, notes, and sources, write " +
  "a clear, well-structured report that answers the question. Cite sources as [n] " +
  "inline. State uncertainty honestly. If there were no external sources, answer " +
  "from your own knowledge and say so. Output Markdown.";

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
  visit: (url: string) => Promise<VisitedPage | null>;
  onStep: (step: ResearchStepRecord) => void;
  /** Registry model id, or undefined = Hermes default (callLLM resolves it). */
  modelId?: string;
  /** Search/visit/reason iterations — research DEPTH (default 3). */
  maxRounds?: number;
  /** Search results requested per query — research BREADTH (default 6). */
  resultsPerQuery?: number;
  /** Top pages visited+read per round (default 2). */
  visitsPerRound?: number;
}

export interface DeepResearchResult {
  report: string;
  provider: string;
}

const VISIT_PER_ROUND = 2;

function firstQuery(planText: string, fallback: string): string {
  const m = planText.match(/QUERY:\s*(.+)/i);
  return m ? m[1].trim() : fallback;
}
function dedupeByUrl(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const r of results) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    out.push(r);
  }
  return out;
}

/** Iterative research: plan → (search → visit → reason)×rounds → synthesize. */
export async function runDeepResearch(
  query: string,
  deps: DeepResearchDeps,
): Promise<DeepResearchResult> {
  const modelId = deps.modelId;
  const maxRounds = Math.max(1, deps.maxRounds ?? 3);
  const resultsPerQuery = Math.max(1, deps.resultsPerQuery ?? 6);
  const visitsPerRound = Math.max(0, deps.visitsPerRound ?? VISIT_PER_ROUND);

  // 1. Plan
  const plan = await deps.llm(
    [
      { role: "system", content: PLAN_SYSTEM },
      { role: "user", content: query },
    ],
    { modelId, temperature: 0.4, maxTokens: 800 },
  );
  deps.onStep({ kind: "plan", input: query, output: plan.content, sources: [] });

  const notes: string[] = [];
  const allSources: SearchResult[] = [];
  let nextQuery: string | null = firstQuery(plan.content, query);

  // 2. Iterate
  for (let round = 0; round < maxRounds && nextQuery; round++) {
    const q = nextQuery;
    nextQuery = null;

    let results: SearchResult[] = [];
    try {
      results = await deps.search.search(q, resultsPerQuery);
    } catch {
      results = [];
    }
    if (results.length > 0) {
      allSources.push(...results);
      deps.onStep({
        kind: "search",
        input: q,
        output: results.map((r) => `${r.title} — ${r.url}`).join("\n"),
        sources: results.map((r) => r.url),
      });
    }

    const visited: VisitedPage[] = [];
    for (const r of results.slice(0, visitsPerRound)) {
      const page = await deps.visit(r.url);
      if (page) {
        visited.push(page);
        deps.onStep({
          kind: "visit",
          input: r.url,
          output: `${page.title}\n${page.content.slice(0, 1200)}`,
          sources: [page.url],
        });
      }
    }

    const evidence =
      visited.length > 0
        ? visited.map((p) => `[${p.url}] ${p.title}\n${p.content.slice(0, 1500)}`).join("\n\n")
        : results.map((r) => `${r.title} — ${r.snippet} (${r.url})`).join("\n") ||
          "(no results this round)";

    const reason = await deps.llm(
      [
        { role: "system", content: REASON_SYSTEM },
        {
          role: "user",
          content:
            `Question:\n${query}\n\nPlan:\n${plan.content}\n\nRound ${round + 1} evidence:\n${evidence}\n\n` +
            `Prior notes:\n${notes.join("\n") || "(none)"}`,
        },
      ],
      { modelId, temperature: 0.5, maxTokens: 1000 },
    );
    deps.onStep({ kind: "reason", input: q, output: reason.content, sources: [] });
    notes.push(reason.content);

    const nextM = reason.content.match(/NEXT QUERY:\s*(.+)/i);
    if (nextM && !/\bDONE\b/i.test(reason.content)) nextQuery = nextM[1].trim();
  }

  // 3. Synthesize
  const sources = dedupeByUrl(allSources);
  const sourceBlock =
    sources.length > 0
      ? sources.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}`).join("\n")
      : "(no external sources — answer from model knowledge)";

  const synth = await deps.llm(
    [
      { role: "system", content: SYNTHESIZE_SYSTEM },
      {
        role: "user",
        content: `Question:\n${query}\n\nPlan:\n${plan.content}\n\nNotes:\n${notes.join("\n\n") || "(none)"}\n\nSources:\n${sourceBlock}`,
      },
    ],
    { modelId, temperature: 0.5, maxTokens: 2400 },
  );
  deps.onStep({
    kind: "synthesize",
    input: sourceBlock,
    output: synth.content,
    sources: sources.map((r) => r.url),
  });

  return { report: synth.content, provider: deps.search.name };
}

/** The real inference fn — callLLM, so local/cloud/Hermes-default all work. */
export const defaultLlm: LlmFn = async (messages, opts) => {
  const res = await callLLM(messages, opts);
  return { content: res.content };
};

/** The real page-visit fn. */
export const defaultVisit = visitPage;
