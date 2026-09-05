// ═══════════════════════════════════════════════════════════════
// orchestration/index.ts — PatterStage orchestration core (public surface)
//
// Owns the mission lifecycle, run reconciliation, and the PatterStage-owned
// scheduler. Hermes (and any future backend) is reached only through the
// framework-agnostic AgentRuntime adapter in src/lib/runtime/.
// ═══════════════════════════════════════════════════════════════

// Consumed via this barrel; the rest of the orchestration internals
// (BackgroundScheduler, RunSync, scheduler tick, boot reconcile) are imported
// directly from their source modules by the server bootstrap.
export { ensureBackgroundScheduler } from "./scheduler/BackgroundScheduler";
export { dispatchMissionRun, stopBackendRunForMission } from "./dispatch";
export { reconcileActiveRuns } from "./run-reconcile";
