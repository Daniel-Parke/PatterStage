/**
 * Regression tests for the post-spawn liveness probe in
 * src/lib/deploy-spawn.ts (`probeDeployLiveness`).
 *
 * The bug this locks down: on a systemd host, ch-deploy is launched via
 * `systemd-run --user ...`. systemd-run is a TRANSIENT-UNIT LAUNCHER — it
 * hands the job to systemd over D-Bus and exits in ~200ms, while the real
 * deploy runs under <unit>.service. The original probe did `kill -0` on the
 * launcher PID, saw it dead after one 200ms poll, and falsely reported
 * "Deploy script exited immediately (PID … after 215ms)" even though the
 * deploy was running fine. The probe must instead watch the systemd unit /
 * the status file, and only use the PID on the nohup fallback path.
 *
 * `probeDeployLiveness` takes injectable deps so these run with a virtual
 * clock — no real processes, no real timers.
 */
import {
  probeDeployLiveness,
  type DeployProbeDeps,
} from "@/lib/deploy-spawn";

type StatusShape = { state: string; phase: string; message: string; logHint: string };

const RUNNING: StatusShape = {
  state: "running",
  phase: "build",
  message: "Rebuild queued…",
  logHint: "ch-update.log",
};

/** Builds deps backed by a virtual clock so the probe loop terminates
 *  deterministically without wall-clock waiting. */
function makeDeps(overrides: Partial<DeployProbeDeps>): DeployProbeDeps {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
    readStatus: () => RUNNING,
    unitActiveState: () => "activating",
    isPidAlive: () => true,
    ...overrides,
  };
}

describe("probeDeployLiveness", () => {
  it("REGRESSION: systemd path succeeds even though the launcher PID is dead", async () => {
    // The launcher PID has already exited (this is normal for systemd-run),
    // but the unit is activating — the deploy is running. Must NOT false-fail.
    const isPidAlive = jest.fn(() => false);
    const result = await probeDeployLiveness(
      29160,
      "ch-rebuild",
      true, // usedSystemd
      makeDeps({ unitActiveState: () => "activating", isPidAlive }),
    );
    expect(result.ok).toBe(true);
    expect(result.pid).toBe(29160);
    // The systemd path must never consult the (irrelevant) launcher PID.
    expect(isPidAlive).not.toHaveBeenCalled();
  });

  it("systemd path: ActiveState=failed surfaces a failure", async () => {
    const result = await probeDeployLiveness(
      100,
      "ch-rebuild",
      true,
      makeDeps({
        unitActiveState: () => "failed",
        readStatus: () => ({ ...RUNNING, message: "build error" }),
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Deploy script failed early");
    expect(result.error).toContain("build error");
  });

  it("systemd path: unit never becomes active → reports it did not start", async () => {
    const result = await probeDeployLiveness(
      100,
      "ch-rebuild",
      true,
      makeDeps({ unitActiveState: () => "inactive" }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("never became active");
    expect(result.error).toContain("ch-rebuild.service");
  });

  it("lock contention (status state=failed, phase=lock) yields the lock message", async () => {
    const result = await probeDeployLiveness(
      100,
      "ch-rebuild",
      true,
      makeDeps({
        readStatus: () => ({
          state: "failed",
          phase: "lock",
          message: "Deploy already in progress",
          logHint: "ch-restart.log",
        }),
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("lock held by another process");
  });

  it("status state=success short-circuits to success (fast restart)", async () => {
    const result = await probeDeployLiveness(
      100,
      "ch-restart",
      true,
      makeDeps({
        unitActiveState: () => "inactive",
        readStatus: () => ({ ...RUNNING, state: "success" }),
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.pid).toBe(100);
  });

  it("nohup path: a PID alive for the whole window succeeds", async () => {
    const result = await probeDeployLiveness(
      4242,
      "ch-rebuild",
      false, // nohup
      makeDeps({ isPidAlive: () => true }),
    );
    expect(result.ok).toBe(true);
    expect(result.pid).toBe(4242);
  });

  it("nohup path: a PID that dies (without success) reports 'exited immediately'", async () => {
    const result = await probeDeployLiveness(
      4242,
      "ch-rebuild",
      false,
      makeDeps({ isPidAlive: () => false }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("exited immediately");
    expect(result.error).toContain("4242");
  });

  it("nohup path: status state=failed beats the PID check", async () => {
    // Even if the PID still looks alive, a terminal failed status wins.
    const result = await probeDeployLiveness(
      4242,
      "ch-rebuild",
      false,
      makeDeps({
        isPidAlive: () => true,
        readStatus: () => ({ ...RUNNING, state: "failed", message: "npm build failed" }),
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("npm build failed");
  });
});
