// ═══════════════════════════════════════════════════════════════
// orchestration/scheduler/BackgroundScheduler.ts
//
// PatterStage's traffic-independent background loop. Unlike the read-side
// sync layer (which historically only ticked when an API route called
// ensureSyncLayer()), this scheduler is started once per server process by
// src/instrumentation.ts — so PatterStage-owned scheduling fires even on an
// idle host with zero inbound HTTP.
//
// It reuses the proven SyncScheduler loop (event-loop yielding + per-source
// timeout race — hardened after the 2026-06-01 outage) and adds a cross-
// process ownership lease in the `meta` table so that, under `next dev`
// double module-evaluation or a brief overlap during restart, only one
// process drives dispatch (gated via isOwner()). Exactly-once dispatch in
// Phase 4 is further protected by a transactional run-insert guard +
// Idempotency-Key, so this lease is defence-in-depth, not the sole guard.
// ═══════════════════════════════════════════════════════════════

import { SyncScheduler } from "@/lib/sync/SyncScheduler";
import type { SyncSource, SyncResult } from "@/lib/sync/types";
import { getSystemStat, upsertMetaValue } from "@/lib/system-repository";
import { RunSync } from "@/lib/orchestration/RunSync";
import { reconcileRunsOnBoot } from "@/lib/orchestration/run-reconcile";
import { SERVER_MODULES } from "@/lib/modules/server";
import { ensureDefaultComposerWorkflows } from "@/lib/composer/seed";
import { ComposerTickSource } from "@/lib/composer/scheduler/composer-tick";
import { ScheduleTickSource } from "./tick";
// The two key names and the stale window are the read side's contract as much
// as this file's, so they live in health.ts and are imported here. A surface
// that reports "the scheduler last ticked N seconds ago" and a scheduler that
// decides "the previous owner is dead" must agree on the same window, and two
// copies of 60_000 in two files is how they stop agreeing.
import { HEARTBEAT_STALE_MS, META_HEARTBEAT, META_OWNER_PID } from "./health";

// The `meta` statements themselves live in system-repository.ts, the one
// repository for that table. These two wrappers stay HERE because the
// try/catch is the point: a lease read that throws must read as "no
// lease info" and a lease write that throws must not crash server boot.
// That is a scheduler policy, not a table policy, and moving the swallow
// into the repository would impose it on every other meta caller.

function readMeta(key: string): string | null {
  try {
    return getSystemStat(key);
  } catch {
    return null;
  }
}

function writeMeta(key: string, value: string): void {
  try {
    upsertMetaValue(key, value);
  } catch {
    // Best-effort: never crash server boot on a meta write failure.
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Internal source that refreshes (or re-acquires) the ownership lease each tick. */
class HeartbeatSource implements SyncSource {
  readonly name = "scheduler-heartbeat";
  constructor(private readonly onTick: () => void) {}
  async sync(): Promise<SyncResult> {
    this.onTick();
    return { sourceName: this.name, success: true, syncedCount: 0, durationMs: 0 };
  }
}

export class BackgroundScheduler {
  private readonly inner: SyncScheduler;
  private started = false;
  private owner = false;

  constructor() {
    this.inner = new SyncScheduler();
  }

  /** Register an orchestration tick source (e.g. the schedule tick added in Phase 4). */
  registerSource(source: SyncSource): void {
    this.inner.register(source);
  }

  /** Whether THIS process currently holds the scheduling lease (gates dispatch). */
  isOwner(): boolean {
    return this.owner;
  }

  /** Start the traffic-independent background loop. Idempotent per process. */
  start(): void {
    if (this.started) return;
    this.started = true;

    this.owner = this.claimOwnership();
    this.inner.register(new HeartbeatSource(() => this.refreshHeartbeat()));
    this.inner.start();

    console.log(
      `[scheduler] BackgroundScheduler started (pid=${process.pid}, owner=${this.owner})`,
    );
  }

  stop(): void {
    this.inner.stop();
    this.started = false;
  }

  /** Acquire the lease unless a different, live process holds a fresh one. */
  private claimOwnership(): boolean {
    const ownerPidRaw = readMeta(META_OWNER_PID);
    const heartbeatRaw = readMeta(META_HEARTBEAT);
    const ownerPid = ownerPidRaw ? Number(ownerPidRaw) : NaN;
    const heartbeatAt = heartbeatRaw ? Date.parse(heartbeatRaw) : NaN;
    const heartbeatFresh =
      Number.isFinite(heartbeatAt) && Date.now() - heartbeatAt < HEARTBEAT_STALE_MS;

    if (
      Number.isFinite(ownerPid) &&
      ownerPid !== process.pid &&
      heartbeatFresh &&
      isPidAlive(ownerPid)
    ) {
      console.warn(
        `[scheduler] live owner (pid=${ownerPid}) holds the scheduling lease — standing down as follower`,
      );
      return false;
    }

    writeMeta(META_OWNER_PID, String(process.pid));
    writeMeta(META_HEARTBEAT, new Date().toISOString());
    return true;
  }

  private refreshHeartbeat(): void {
    if (!this.owner) {
      // Previous owner may have died — try to take over.
      this.owner = this.claimOwnership();
      return;
    }
    writeMeta(META_HEARTBEAT, new Date().toISOString());
  }
}

// ── Singleton ────────────────────────────────────────────────

let _scheduler: BackgroundScheduler | null = null;

function getBackgroundScheduler(): BackgroundScheduler {
  if (!_scheduler) _scheduler = new BackgroundScheduler();
  return _scheduler;
}

let _ensured = false;

/** Boot the background scheduler once per process. Called from instrumentation. */
export function ensureBackgroundScheduler(): BackgroundScheduler {
  const scheduler = getBackgroundScheduler();
  if (_ensured) return scheduler;
  _ensured = true;

  // Recover runs left 'started' by a previous process (network-free).
  try {
    reconcileRunsOnBoot();
  } catch (err) {
    console.warn("[scheduler] boot run-reconcile failed:", err);
  }
  // Module rows left mid-flight by a previous process, through the
  // composition root (ADR-0005: core does not import a module). Stories
  // first (T-0087).
  for (const mod of SERVER_MODULES) {
    if (!mod.reconcileOnBoot) continue;
    try {
      mod.reconcileOnBoot();
    } catch (err) {
      console.warn("[scheduler] boot " + mod.id + " reconcile failed:", err);
    }
  }

  // Seed the built-in Composer workflow(s) (idempotent).
  try {
    ensureDefaultComposerWorkflows();
  } catch (err) {
    console.warn("[scheduler] composer seed failed:", err);
  }

  // Orchestration sources: reconcile active runs, then fire due schedules.
  // The schedule tick only dispatches when this process holds the lease.
  scheduler.registerSource(new RunSync());
  scheduler.registerSource(new ScheduleTickSource(() => scheduler.isOwner()));
  // Composer graph orchestrator (no-op until the `composer` flag is on).
  scheduler.registerSource(new ComposerTickSource(() => scheduler.isOwner()));

  scheduler.start();
  return scheduler;
}
