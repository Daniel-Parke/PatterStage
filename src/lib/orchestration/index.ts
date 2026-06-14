// ═══════════════════════════════════════════════════════════════
// orchestration/index.ts — Control Hub orchestration core (public surface)
//
// Owns the mission lifecycle, run reconciliation, and the Control Hub-owned
// scheduler. Hermes (and any future backend) is reached only through the
// framework-agnostic AgentRuntime adapter in src/lib/runtime/.
// ═══════════════════════════════════════════════════════════════

export {
  BackgroundScheduler,
  getBackgroundScheduler,
  ensureBackgroundScheduler,
} from "./scheduler/BackgroundScheduler";

export { dispatchMissionRun, cancelMissionRun, type DispatchResult } from "./dispatch";
export {
  reconcileActiveRuns,
  reconcileRunsOnBoot,
  finalizeMissionForRun,
} from "./run-reconcile";
export { RunSync } from "./RunSync";
export { runSchedulerTick, ScheduleTickSource } from "./scheduler/tick";
