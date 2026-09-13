// ═══════════════════════════════════════════════════════════════
// Shared types for Hindsight memory components
// ═══════════════════════════════════════════════════════════════

export interface Memory {
  id?: string;
  content: string;
  type?: string;
  // `tags` is intentionally `unknown` so a future payload-shape
  // change can't blow up the page render. The MemoryTab runtime-
  // narrows the value with `Array.isArray` + `typeof t === "string"`.
  tags?: unknown;
  /**
   * How many proofs Hindsight holds for this fact. Named for what it is: it
   * was called `score`, which made a percentage look like a reasonable render
   * and produced "Relevance: 100%" for every single-proof fact (T-0101, D63).
   */
  proofCount?: number;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

export interface Directive {
  id: string;
  name: string;
  content: string;
  priority: number;
  is_active: boolean;
  tags: string[];
  created_at: string;
}

export interface MentalModel {
  id: string;
  name: string;
  source_query: string;
  content: string;
  tags: string[];
  created_at: string;
  last_refreshed_at: string;
}

export type Tab = "memories" | "directives" | "mental-models";

export interface HealthState {
  available: boolean;
  mode: string;
  message?: string;
  error?: string;
}