// ═══════════════════════════════════════════════════════════════
// instrumentation.ts — Next.js server boot hook
//
// register() runs once when the Next.js server process starts (next start /
// next dev), BEFORE any request is handled. We use it to boot Control Hub's
// traffic-independent background loops so that the Control Hub-owned scheduler
// fires on schedule even on a fully idle host — the previous design only
// ticked when an API route happened to call ensureSyncLayer(), which meant a
// scheduled mission at 03:00 on an idle box would never run.
//
// Gated to the Node.js runtime: the Edge runtime has no filesystem / SQLite.
// ═══════════════════════════════════════════════════════════════

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Read-side sync layer (config / env / logs / sessions / memory drift sources).
  const { ensureSyncLayer } = await import("@/lib/sync");
  ensureSyncLayer();

  // Orchestration scheduler host (Control Hub-owned scheduling + run reconcile).
  const { ensureBackgroundScheduler } = await import("@/lib/orchestration");
  ensureBackgroundScheduler();

  // Benchmark run recovery: fail runs left 'running' by a crashed process and
  // re-kick any that were created but never started.
  const { recoverBenchmarkRuns } = await import("@/lib/benchmarks/executor");
  recoverBenchmarkRuns();
}
