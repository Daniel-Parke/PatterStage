// ═══════════════════════════════════════════════════════════════
// laboratory/deep-research/types.ts — native DeepResearch contracts
//
// A research run is a query → a synthesized report, produced by an iterative
// plan→search→visit→reason→synthesize loop (this pass ships the minimal
// single-pass MVP; the full IterResearch loop is the next phase). Inference is
// provider-flexible via callLLM (local endpoint or cloud, default = Hermes).
// ═══════════════════════════════════════════════════════════════

import type { ResearchUsageTotal } from "./usage";

export type ResearchStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type ResearchStepKind = "plan" | "search" | "visit" | "reason" | "synthesize";

/** User-chosen options for a research run (depth/breadth/model/provider). */
export interface ResearchConfig {
  /** Registry model id, or null = the Hermes default. */
  modelId?: string | null;
  /** Search backend: duckduckgo | searxng | none. */
  searchProvider?: string;
  /** Research DEPTH — search/reason iterations (1–8). */
  rounds?: number;
  /** Research BREADTH — search results per query (1–12). */
  resultsPerQuery?: number;
  /** Top pages read per round (0–6). */
  visitsPerRound?: number;
}

export interface ResearchRun {
  id: string;
  query: string;
  status: ResearchStatus;
  /** Search backend used (duckduckgo | searxng | none). */
  provider: string | null;
  /** Registry model id used for inference, or null = the Hermes default. */
  modelId: string | null;
  /** The options the run was launched with (model/provider/depth/breadth). */
  config: ResearchConfig | null;
  report: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  /**
   * Tokens the run's LLM calls reported, or null when none did.
   *
   * null is NOT zero. Every run before migration 034 is null, meaning the cost
   * is unknown, and the spend console reports those separately rather than
   * folding them in at nothing (T-0030).
   */
  usage: ResearchUsageTotal | null;
  /**
   * How much of the run's evidence was actually gathered, or null when the run
   * predates migration 036 and nobody measured.
   *
   * Same rule as `usage` above: null is not a clean gather, it is an unmeasured
   * one. A run with `{searchAttempts: 8, searchFailures: 5}` wrote its report
   * from three sources out of eight and said nothing about it (T-0070).
   */
  gather: ResearchGatherHealth | null;
}

/** The four counters describing how much of a run's evidence was collected. */
export interface ResearchGatherHealth {
  searchAttempts: number;
  searchFailures: number;
  visitAttempts: number;
  visitFailures: number;
}

/** A saved, reusable Deep Research configuration. */
export interface ResearchPreset {
  id: string;
  name: string;
  config: ResearchConfig;
  createdAt: string;
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
