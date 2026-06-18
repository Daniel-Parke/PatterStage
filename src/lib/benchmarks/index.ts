// ═══════════════════════════════════════════════════════════════
// benchmarks/index.ts — public surface of the benchmarking module
// ═══════════════════════════════════════════════════════════════

export * from "./types";
export {
  startBenchmarkRun,
  startComparePair,
  kickBenchmarkRun,
  cancelBenchmarkRun,
  recoverBenchmarkRuns,
  type StartBenchmarkInput,
  type CompareInput,
} from "./executor";
export {
  getBenchmarkRun,
  listBenchmarkRuns,
  listItemResults,
  latestCompletedRun,
} from "./benchmarks-repository";
export { listSuiteMeta, suiteMeta, getSuite, type SuiteMeta } from "./suites";
