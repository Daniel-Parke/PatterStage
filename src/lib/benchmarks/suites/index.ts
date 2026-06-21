// ═══════════════════════════════════════════════════════════════
// suites/index.ts — the in-code registry of benchmark suites
//
// Suites are version-controlled data, not DB rows. Register each suite here;
// the runner/API resolve a suite by key (and validate the version recorded on
// a run still matches, so a run is reproducible against its suite version).
// ═══════════════════════════════════════════════════════════════

import type { BenchmarkSuite, BenchmarkDomain } from "../types";
import { coreCapabilitiesV1 } from "./core-capabilities-v1";
import { reasoningDepthV1 } from "./reasoning-depth-v1";
import { appliedCapabilitiesV1 } from "./applied-capabilities-v1";
import { judgementV1 } from "./judgement-v1";
import { frontierV1 } from "./frontier-v1";

export const SUITES: BenchmarkSuite[] = [coreCapabilitiesV1, reasoningDepthV1, appliedCapabilitiesV1, judgementV1, frontierV1];

export function getSuite(key: string): BenchmarkSuite | undefined {
  return SUITES.find((s) => s.key === key);
}

/** Per-domain item counts for a suite (for UI summaries; no answers leaked). */
function domainCounts(suite: BenchmarkSuite): Partial<Record<BenchmarkDomain, number>> {
  const out: Partial<Record<BenchmarkDomain, number>> = {};
  for (const item of suite.items) {
    out[item.domain] = (out[item.domain] ?? 0) + 1;
  }
  return out;
}

/** Client-safe suite metadata — never includes prompts or answer keys. */
export interface SuiteMeta {
  key: string;
  name: string;
  version: string;
  description: string;
  itemCount: number;
  domainCounts: Partial<Record<BenchmarkDomain, number>>;
}

function suiteMeta(suite: BenchmarkSuite): SuiteMeta {
  return {
    key: suite.key,
    name: suite.name,
    version: suite.version,
    description: suite.description,
    itemCount: suite.items.length,
    domainCounts: domainCounts(suite),
  };
}

export function listSuiteMeta(): SuiteMeta[] {
  return SUITES.map(suiteMeta);
}
