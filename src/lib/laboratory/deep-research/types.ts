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

// Search contracts live in the shared search module (reused beyond research).
export type { SearchResult, SearchProvider, VisitedPage } from "@/lib/search/types";
