/**
 * Liveness probe for the cross-platform deploy runner (src/lib/deploy-spawn.ts
 * `probeDeployLiveness`). The runner (scripts/tooling/ps-deploy.mjs) is spawned
 * detached via `node` on every OS and is the source of truth: it writes
 * state=running early and state=failed/success terminally. The probe fails fast
 * only on a terminal failure, or the process dying before reaching one.
 *
 * Deps are injectable so these run on a virtual clock — no real processes.
 */
import { probeDeployLiveness, type DeployProbeDeps } from "@/lib/deploy-spawn";

type StatusShape = { state: string; phase: string; message: string; logHint: string };

const RUNNING: StatusShape = {
  state: "running",
  phase: "build",
  message: "Rebuild queued…",
  logHint: "ps-update.log",
};

function makeDeps(overrides: Partial<DeployProbeDeps>): DeployProbeDeps {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
    readStatus: () => RUNNING,
    isPidAlive: () => true,
    ...overrides,
  };
}

describe("probeDeployLiveness", () => {
  it("running + PID alive for the whole window → success (deploy is proceeding)", async () => {
    const result = await probeDeployLiveness(4242, makeDeps({ isPidAlive: () => true }));
    expect(result.ok).toBe(true);
    expect(result.pid).toBe(4242);
  });

  it("status=success short-circuits to success (fast restart)", async () => {
    const result = await probeDeployLiveness(
      100,
      makeDeps({ readStatus: () => ({ ...RUNNING, state: "success" }) }),
    );
    expect(result.ok).toBe(true);
    expect(result.pid).toBe(100);
  });

  it("terminal status=failed surfaces the failure message", async () => {
    const result = await probeDeployLiveness(
      100,
      makeDeps({ readStatus: () => ({ ...RUNNING, state: "failed", message: "build error" }) }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Deploy failed early");
    expect(result.error).toContain("build error");
  });

  it("lock contention (state=failed, phase=lock) yields the lock message", async () => {
    const result = await probeDeployLiveness(
      100,
      makeDeps({
        readStatus: () => ({
          state: "failed",
          phase: "lock",
          message: "Deploy already in progress",
          logHint: "ps-restart.log",
        }),
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("lock held by another process");
  });

  it("a PID that dies without a terminal status reports 'exited immediately'", async () => {
    const result = await probeDeployLiveness(4242, makeDeps({ isPidAlive: () => false }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("exited immediately");
    expect(result.error).toContain("4242");
  });

  it("a PID that dies AFTER writing success still succeeds (race)", async () => {
    const result = await probeDeployLiveness(
      4242,
      makeDeps({ isPidAlive: () => false, readStatus: () => ({ ...RUNNING, state: "success" }) }),
    );
    expect(result.ok).toBe(true);
  });

  it("terminal failed status beats a still-alive PID", async () => {
    const result = await probeDeployLiveness(
      4242,
      makeDeps({
        isPidAlive: () => true,
        readStatus: () => ({ ...RUNNING, state: "failed", message: "npm build failed" }),
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("npm build failed");
  });
});
