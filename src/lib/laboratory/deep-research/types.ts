// ═══════════════════════════════════════════════════════════════
// laboratory/deep-research/types.ts — native DeepResearch contracts
//
// A research run is a query → a synthesized report, produced by an iterative
// plan→search→visit→reason→synthesize loop (this pass ships the minimal
// single-pass MVP; the full IterResearch loop is the next phase). Inference is
// provider-flexible via callLLM (local endpoint or cloud, default = Hermes).
// ═══════════════════════════════════════════════════════════════

export type ResearchStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type ResearchStepKind = "plan" | "search" | "visit" | "reason" | "synthesize";

export interface ResearchRun {
  id: string;
  query: string;
  status: ResearchStatus;
  /** Search backend used (serper | tavily | brave | searxng | none). */
  provider: string | null;
  /** Registry model id used for inference, or null = the Hermes default. */
  modelId: string | null;
  report: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ResearchStep {
  id: string;
  runId: string;
  position: number;
  kind: ResearchStepKind;
  input: string | null;
  output: string | null;
  sources: string[];
  createdAt: string;
}

/** One web search hit. */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Pluggable search backend. Implementations: serper/tavily/brave (cloud) or
 * searxng (self-hosted = fully local). The null provider returns [] so the
 * engine runs LLM-only when no search is configured.
 */
export interface SearchProvider {
  readonly name: string;
  search(query: string, limit?: number): Promise<SearchResult[]>;
}
