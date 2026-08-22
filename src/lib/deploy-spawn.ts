// ═══════════════════════════════════════════════════════════════
// deploy-spawn.ts — spawn the cross-platform deploy runner + verify it started
// ═══════════════════════════════════════════════════════════════
// The deploy logic lives in scripts/tooling/ps-deploy.mjs (Windows/macOS/Linux).
// We launch it as `node ps-deploy.mjs <action>` fully detached so it outlives
// the next-server it restarts — no bash, systemd, or nohup. The liveness probe
// is unit-testable without real processes (tests/unit/deploy-spawn-probe.test.ts).

import { existsSync } from "fs";

import { detachedSpawn, isPidAlive as platformIsPidAlive } from "@/lib/platform";
import { readDeployStatus } from "@/lib/deploy-status";

export interface SpawnResult {
  ok: boolean;
  error?: string;
  pid?: number;
}

const PROBE_DEADLINE_MS = 2000;
const PROBE_POLL_MS = 200;

/**
 * Spawn `node scripts/tooling/ps-deploy.mjs <args>` detached. Returns once the
 * deploy is confirmed running (the runner wrote state=running/success) or to
 * have failed immediately (terminal state=failed, or the process died before
 * reaching a terminal status).
 *
 * @param scriptPath absolute path to ps-deploy.mjs
 * @param _label     action label (kept for call-site compatibility)
 */
export async function spawnDeploy(
  scriptPath: string,
  _label: string,
  deployArgs: string[],
  deps: DeployProbeDeps = defaultProbeDeps,
): Promise<SpawnResult> {
  if (!existsSync(scriptPath)) {
    return { ok: false, error: "Deploy runner missing (scripts/tooling/ps-deploy.mjs)" };
  }
  const pid = detachedSpawn(process.execPath, [scriptPath, ...deployArgs]);
  if (pid === undefined) {
    return { ok: false, error: "Failed to spawn the deploy runner" };
  }
  return await probeDeployLiveness(pid, deps);
}

// ── Post-spawn liveness probe ───────────────────────────────────
//
// The runner is the source of truth: route.ts pre-writes state=running, and the
// runner writes state=failed/state=success terminally (ps-deploy.status, read
// by deploy-status.ts). We fail fast only on an explicit failure: a terminal
// state=failed, or the process dying before it ever reached a terminal status.

/** Injectable probes so the logic is testable without real processes/timers. */
export interface DeployProbeDeps {
  readStatus: () => { state: string; phase: string; message: string; logHint: string };
  isPidAlive: (pid: number) => boolean;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const defaultProbeDeps: DeployProbeDeps = {
  readStatus: () => readDeployStatus(),
  isPidAlive,
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

export async function probeDeployLiveness(
  childPid: number | undefined,
  deps: DeployProbeDeps = defaultProbeDeps,
): Promise<SpawnResult> {
  const probeStart = deps.now();

  const failureFromStatus = (): SpawnResult => {
    const status = deps.readStatus();
    if (status.phase === "lock") {
      return {
        ok: false,
        error:
          "Deploy already in progress (lock held by another process). Wait for the current deploy to finish.",
      };
    }
    const log = status.logHint || "ps-update.log";
    return {
      ok: false,
      // design-lint-disable-next-line hermes-outside-adapter -- the deploy runner is a detached child process, so its failure reason is only ever in its log file. This message exists to hand the operator that filename; the port has no seam that carries a sentence.
      error: `Deploy failed early — ${status.message || "see logs"}. Check ~/.hermes/logs/${log} for the cause.`,
    };
  };

  while (deps.now() - probeStart < PROBE_DEADLINE_MS) {
    const status = deps.readStatus();
    if (status.state === "failed") return failureFromStatus();
    if (status.state === "success") return { ok: true, pid: childPid };

    if (typeof childPid === "number" && !deps.isPidAlive(childPid)) {
      // The runner exited before a terminal status. Re-check (it may have
      // written success between polls); otherwise this is an early failure.
      const s = deps.readStatus();
      if (s.state === "success") return { ok: true, pid: childPid };
      if (s.state === "failed") return failureFromStatus();
      const log = s.logHint || "ps-update.log";
      return {
        ok: false,
        // design-lint-disable-next-line hermes-outside-adapter -- same reason as the branch above: a runner that died before writing a status has left nothing behind except its log, and this string is how the operator is told where that is.
        error: `Deploy runner exited immediately (PID ${childPid} after ${deps.now() - probeStart}ms). Check ~/.hermes/logs/${log}.`,
      };
    }

    await deps.sleep(PROBE_POLL_MS);
  }

  // Window elapsed with the runner alive and status not terminal-failed → it's
  // proceeding (build/restart take longer than the probe window); report ok.
  return { ok: true, pid: childPid };
}

/** True iff the process exists. Cross-platform (delegates to platform.ts). */
function isPidAlive(pid: number): boolean {
  return platformIsPidAlive(pid);
}
