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
import { accumulateUsage, type ResearchUsage, type ResearchUsageTotal } from "./usage";

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
  "You are a rigorous research analyst writing a comprehensive, publication-quality " +
  "report. Using the plan, notes, and sources, produce a thorough Markdown report " +
  "with these sections (use `##` headings):\n" +
  "1. **In brief** — the report OPENS with `## In brief`, then three to five " +
  "one-line bullets carrying the whole answer, so a reader gets it in ten seconds. " +
  "Bullets only in this section: no lead-in sentence, no sub-headings.\n" +
  "2. **Executive summary** — 3–5 sentences answering the question directly.\n" +
  "3. **Key findings** — the answer broken out per sub-question, with specifics " +
  "(numbers, dates, named entities) and `[n]` citations on the sentences they support.\n" +
  "4. **Evidence & analysis** — weigh the sources; quote briefly where it matters; " +
  "note where they agree or conflict.\n" +
  "5. **Open questions / limitations** — what remains uncertain or unsourced.\n" +
  "6. **Conclusion** — a crisp bottom line.\n" +
  "Cite sources inline as [n]. Be substantive and well-organised, not a stub — aim " +
  "for depth over brevity. State uncertainty honestly; never fabricate a citation. " +
  "If there were no external sources, answer from your own knowledge and say so.";

export type LlmFn = (
  messages: LLMMessage[],
  opts: { modelId?: string; temperature?: number; maxTokens?: number },
) => Promise<{ content: string; usage?: ResearchUsage }>;

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
  /** How many search calls were attempted across every round. */
  searchAttempts: number;
  /**
   * How many of those THREW. A search that legitimately returns zero results is
   * not a failure; a search provider that is down or misconfigured is.
   *
   * The caller uses this to refuse to mark a run `completed`. Without it, every
   * search failure collapsed to `results = []`, the synthesis prompt fell back
   * to "(no external sources - answer from model knowledge)", and a total search
   * outage shipped a confident, cited-looking report indistinguishable from a
   * real one. The honest-failure stance is borrowed from the benchmark runner,
   * which failed a whole run rather than score it zero when everything errored.
   */
  searchFailures: number;
  /** How many page reads were attempted across every round. */
  visitAttempts: number;
  /**
   * How many of those came back with nothing usable.
   *
   * The visit loop skipped a null page with a bare `if (page)` and counted
   * nothing, so a run where every page fetch was blocked -- paywalls, robots,
   * timeouts -- reported identically to one where every page was read in full.
   * Unlike a search failure this is not fatal on its own: the round still has
   * the search snippets to reason over. It is evidence the report was written
   * from less than it looks like, which is what the caveat says (T-0070).
   */
  visitFailures: number;
  /**
   * Tokens every LLM call in the run reported, summed, or null if none did.
   *
   * null is NOT a zero total. It means the providers reported nothing, so the
   * run's cost is unknown and must be persisted as NULL and declared in the
   * spend console rather than folded into a figure at zero (T-0030). The same
   * honest-failure stance as `searchFailures` above: say the thing is unknown
   * instead of shipping a confident number that looks real.
   */
  usage: ResearchUsageTotal | null;
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
  // Every LLM call in the run lands here, so the total below is the whole run
  // rather than whichever call was most convenient to instrument (T-0030).
  const usageCalls: Array<ResearchUsage | undefined> = [];

  const plan = await deps.llm(
    [
      { role: "system", content: PLAN_SYSTEM },
      { role: "user", content: query },
    ],
    { modelId, temperature: 0.4, maxTokens: 800 },
  );
  usageCalls.push(plan.usage);
  deps.onStep({ kind: "plan", input: query, output: plan.content, sources: [] });

  const notes: string[] = [];
  const allSources: SearchResult[] = [];
  let nextQuery: string | null = firstQuery(plan.content, query);
  let searchAttempts = 0;
  let searchFailures = 0;
  let visitAttempts = 0;
  let visitFailures = 0;

  // 2. Iterate
  for (let round = 0; round < maxRounds && nextQuery; round++) {
    const q = nextQuery;
    nextQuery = null;

    let results: SearchResult[] = [];
    searchAttempts += 1;
    try {
      results = await deps.search.search(q, resultsPerQuery);
    } catch {
      // Still swallowed HERE so one bad round does not abort the whole run, but
      // counted so the caller can tell "nothing found" from "search is down".
      searchFailures += 1;
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
      visitAttempts += 1;
      const page = await deps.visit(r.url);
      if (!page) visitFailures += 1;
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
    usageCalls.push(reason.usage);
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
    { modelId, temperature: 0.5, maxTokens: 4000 },
  );
  usageCalls.push(synth.usage);
  deps.onStep({
    kind: "synthesize",
    input: sourceBlock,
    output: synth.content,
    sources: sources.map((r) => r.url),
  });

  return {
    report: synth.content,
    provider: deps.search.name,
    searchAttempts,
    searchFailures,
    visitAttempts,
    visitFailures,
    // null, NOT a zeroed total, when no provider reported anything. The
    // caller persists that as NULL so the spend console can say the cost is
    // unknown rather than showing a confident $0.00.
    usage: accumulateUsage(usageCalls),
  };
}

/** The real inference fn — callLLM, so local/cloud/Hermes-default all work. */
export const defaultLlm: LlmFn = async (messages, opts) => {
  const res = await callLLM(messages, opts);
  // res.usage was dropped here until T-0030, which is the whole reason Deep
  // Research spend could not be counted even in principle.
  return { content: res.content, usage: res.usage };
};

/** The real page-visit fn. */
export const defaultVisit = visitPage;
