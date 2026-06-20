// ═══════════════════════════════════════════════════════════════
// deploy-spawn.ts — spawn ch-deploy.sh detached + verify it started
// ═══════════════════════════════════════════════════════════════
// Extracted from src/app/api/update/route.ts so the liveness-probe logic
// is unit-testable without spawning real processes or waiting on real
// wall-clock timers (see tests/unit/deploy-spawn-probe.test.ts).

import { execFileSync, spawn } from "child_process";

import { readDeployStatus } from "@/lib/deploy-status";

export interface SpawnResult {
  ok: boolean;
  error?: string;
  pid?: number;
}

const PROBE_DEADLINE_MS = 2000;
const PROBE_POLL_MS = 200;

function quoteShellSingle(arg: string): string {
  return "'" + arg.replace(/'/g, "'\"'\"'") + "'";
}

/**
 * Spawn `bash ch-deploy.sh <args>` fully detached so it outlives the
 * next-server process that started it. Returns once the deploy has been
 * confirmed to have started (or to have failed immediately).
 *
 * Prefers a systemd `--user` transient unit (clean process supervision on
 * a systemd host); falls back to `nohup` in Docker / minimal environments.
 */
export async function spawnChDeploy(
  scriptPath: string,
  unitName: string,
  deployArgs: string[],
  deps: DeployProbeDeps = defaultProbeDeps,
): Promise<SpawnResult> {
  try {
    execFileSync("bash", ["-n", scriptPath], { stdio: "ignore", timeout: 8000 });
  } catch {
    return { ok: false, error: "Deploy script missing or not readable by bash" };
  }

  const command =
    `sleep 1; bash ${quoteShellSingle(scriptPath)} ${deployArgs.map(quoteShellSingle).join(" ")}`.trimEnd();

  let spawned: SpawnResult = { ok: false, error: "no spawn path attempted" };

  // spawn() returns a child with a PID before an ENOENT for a missing binary
  // surfaces asynchronously — attach an error handler so the failure doesn't
  // bubble up as an uncaughtException in the next-server event loop, and only
  // trust a PID we can actually observe.
  const trySpawn = (cmd: string, args: string[]): number | undefined => {
    try {
      const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
      child.on("error", () => {
        /* surfaced via spawned.ok=false, not via uncaughtException */
      });
      if (typeof child.pid === "number" && child.pid > 0) {
        child.unref();
        return child.pid;
      }
      return undefined;
    } catch {
      return undefined;
    }
  };

  // Clear any stale failed transient unit before spawning (best-effort).
  try {
    execFileSync("systemctl", ["--user", "reset-failed", `${unitName}.service`], {
      stdio: "ignore",
      timeout: 5000,
    });
  } catch {
    // reset-failed fails if the unit doesn't exist or systemctl is missing — fine
  }

  // Check whether systemd-run is actually available BEFORE trying it: spawn()
  // hands back a PID before the ENOENT for a missing binary surfaces, so blindly
  // trusting the PID leads to the child dying 1ms later.
  let systemdRunAvailable = false;
  try {
    execFileSync("which", ["systemd-run"], { stdio: "ignore" });
    systemdRunAvailable = true;
  } catch {
    systemdRunAvailable = false;
  }

  let usedSystemd = false;
  if (systemdRunAvailable) {
    const sysPid = trySpawn("systemd-run", [
      "--user",
      `--unit=${unitName}`,
      "--property=Type=oneshot",
      "bash",
      "-c",
      command,
    ]);
    if (sysPid !== undefined) {
      spawned = { ok: true, pid: sysPid };
      usedSystemd = true;
    }
  }

  if (!spawned.ok) {
    // Fall back to nohup. Works in Docker containers and minimal environments
    // where systemd isn't available.
    const bgPid = trySpawn("nohup", ["bash", "-c", command]);
    spawned = bgPid !== undefined
      ? { ok: true, pid: bgPid }
      : { ok: false, error: "nohup spawn returned no pid" };
  }

  if (!spawned.ok) return spawned;

  return await probeDeployLiveness(spawned.pid, unitName, usedSystemd, deps);
}

// ── Post-spawn liveness probe ───────────────────────────────────
//
// Close the silent-failure window WITHOUT false positives on systemd hosts.
//
// History:
//  - 2026-06-08: the deploy script could die silently (lock contention,
//    missing tool) while the API returned 200 {status:"started"} and the UI
//    spun forever. A probe was added.
//  - The first probe naively did `kill -0 <spawned.pid>`. That is correct for
//    the nohup path (nohup exec's into bash, so the pid IS the deploy). But for
//    the systemd-run path the pid is the *transient-unit launcher*, which hands
//    the job to systemd over D-Bus and exits in ~200ms. The probe then saw a
//    dead pid after one 200ms poll and reported "Deploy script exited
//    immediately (PID … after 215ms)" even though the deploy was running fine
//    under <unit>.service. That false positive is what this design fixes.
//
// Strategy: the deploy script is the source of truth. It writes state=running
// early and state=failed/state=success terminally (ch-deploy.status). We fail
// fast only on an *explicit* failure signal:
//   - status file state=failed (either path), or
//   - systemd unit ActiveState=failed (systemd path).
// Liveness is confirmed per-path:
//   - systemd: the unit reaches activating/active (the command's `sleep 1`
//     guarantees this is observable within the window). If the unit never goes
//     active and never reports success, systemd-run failed to register it.
//   - nohup: `kill -0 <pid>` on the real bash process.

/** Injectable probes so the liveness logic is testable without real processes
 *  or wall-clock timers. */
export interface DeployProbeDeps {
  readStatus: () => { state: string; phase: string; message: string; logHint: string };
  unitActiveState: (unitName: string) => string;
  isPidAlive: (pid: number) => boolean;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

export const defaultProbeDeps: DeployProbeDeps = {
  readStatus: () => readDeployStatus(),
  unitActiveState,
  isPidAlive,
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

export async function probeDeployLiveness(
  childPid: number | undefined,
  unitName: string,
  usedSystemd: boolean,
  deps: DeployProbeDeps = defaultProbeDeps,
): Promise<SpawnResult> {
  const probeStart = deps.now();
  let everActive = false;

  const failureFromStatus = (): SpawnResult => {
    const status = deps.readStatus();
    if (status.phase === "lock") {
      return {
        ok: false,
        error:
          "Deploy already in progress (lock held by another process). Wait for the current deploy to finish or run: rm -f /tmp/ch-deploy.lock",
      };
    }
    const log = status.logHint || "ch-update.log";
    return {
      ok: false,
      error: `Deploy script failed early — ${status.message || "see logs"}. Check ~/.hermes/logs/${log} for the cause.`,
    };
  };

  while (deps.now() - probeStart < PROBE_DEADLINE_MS) {
    const status = deps.readStatus();

    // Authoritative failure: the script wrote a terminal failed state.
    if (status.state === "failed") return failureFromStatus();
    // Authoritative success: a fast action (e.g. restart) already finished.
    if (status.state === "success") return { ok: true, pid: childPid };

    if (usedSystemd) {
      const active = deps.unitActiveState(unitName);
      if (active === "failed") return failureFromStatus();
      if (active === "active" || active === "activating") everActive = true;
    } else if (typeof childPid === "number") {
      if (!deps.isPidAlive(childPid)) {
        const log = deps.readStatus().logHint || "ch-update.log";
        return {
          ok: false,
          error: `Deploy script exited immediately (PID ${childPid} no longer alive after ${deps.now() - probeStart}ms). Check ~/.hermes/logs/${log} for the cause.`,
        };
      }
    }

    await deps.sleep(PROBE_POLL_MS);
  }

  // Window elapsed. On the systemd path, if we never once saw the unit active
  // and the script never reported success, systemd-run failed to register the
  // transient unit — surface it rather than claim a successful start.
  if (usedSystemd && !everActive && deps.readStatus().state !== "success") {
    const log = deps.readStatus().logHint || "ch-update.log";
    return {
      ok: false,
      error: `Deploy did not start (systemd unit ${unitName}.service never became active). Check ~/.hermes/logs/${log} or run: systemctl --user status ${unitName}.service`,
    };
  }

  return { ok: true, pid: childPid };
}

/** Reads a systemd --user unit's ActiveState (active/activating/inactive/failed/""). */
export function unitActiveState(unitName: string): string {
  try {
    return execFileSync(
      "systemctl",
      ["--user", "show", `${unitName}.service`, "--property=ActiveState", "--value"],
      { encoding: "utf-8", timeout: 3000 },
    ).trim();
  } catch {
    return "";
  }
}

/** True iff the process exists (kill -0 is a no-op that only checks existence). */
export function isPidAlive(pid: number): boolean {
  try {
    execFileSync("kill", ["-0", String(pid)], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
