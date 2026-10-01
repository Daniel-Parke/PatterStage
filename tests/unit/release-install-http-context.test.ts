/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

type Observation = {
  accepted: boolean; launched: number; ownedStopped: boolean; decoySurvived: boolean;
  signalsOwned: boolean; withinDeadline: boolean; requestsBounded: boolean; connectBounded: boolean;
  credentialLeaked: boolean; scriptContainsCredential: boolean;
  requests: { path: string; credential: string; status: number }[];
  listenerControlStatuses: number[]; identity: [number, number][];
  entries: { shellPid: number; bashPid: number; phase: string }[];
  completedExits: number[]; returnedExits: number[]; injected: string[]; probeExit: number;
  scratchAttempts: number; scratchCreated: number; scratchExclusive: boolean;
  scratchPrivate: boolean; scratchOwned: boolean; scratchRemoved: boolean;
  scratchCreatedBeforeLaunch: boolean; elapsedSeconds: number; faultControl: boolean;
  native: { calls: number; errors: number; cancelled: number; statuses: number[];
    clients: Record<string, string>; ownedCurlStopped: boolean; listenerStopped: boolean;
    ipcStopped: boolean; environmentRegistered: boolean };
};
let observations: Record<string, Observation>;

beforeAll(() => {
  const result = spawnSync(process.env.PYTHON || "python", [resolve("tests/helpers/release-install-http-context-probe.py")], {
    cwd: process.cwd(), encoding: "utf8", timeout: 240_000, maxBuffer: 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  if (result.error || result.status !== 0) throw new Error(`T-0205 observer infrastructure failed (${result.status})`);
  observations = JSON.parse(result.stdout) as Record<string, Observation>;
}, 250_000);

function clean(result: Observation, launched = 1): void {
  expect(result.launched).toBe(launched);
  expect(result.ownedStopped).toBe(true);
  expect(result.decoySurvived).toBe(true);
  expect(result.signalsOwned).toBe(true);
  expect(result.withinDeadline).toBe(true);
  expect(result.elapsedSeconds).toBeLessThan(25);
  expect(result.credentialLeaked).toBe(false);
  expect(result.scriptContainsCredential).toBe(false);
  expect(result.native.errors).toBe(0);
  expect(result.native.cancelled).toBe(0);
  expect(result.native.ownedCurlStopped).toBe(true);
  expect(result.native.listenerStopped).toBe(true);
  expect(result.native.ipcStopped).toBe(true);
}

function mainContext(result: Observation): void {
  expect(result.identity).toHaveLength(1);
  const [shellPid, bashPid] = result.identity[0];
  expect(shellPid).toBeGreaterThan(0);
  expect(bashPid).toBeGreaterThan(0);
  expect(result.entries.length).toBeGreaterThan(0);
  for (const entry of result.entries) {
    expect(entry.shellPid).toBe(shellPid);
    expect(entry.bashPid).toBe(bashPid);
  }
  expect(result.native.calls).toBe(result.entries.length);
  expect(result.completedExits).toEqual(result.native.statuses);
  expect(result.native.environmentRegistered).toBe(true);
  expect(Object.values(result.native.clients)).toEqual([expect.stringMatching(/^[a-f0-9]{64}$/)]);
  expect(result.requestsBounded).toBe(true);
  expect(result.connectBounded).toBe(true);
}

function scratch(result: Observation): void {
  expect(result.scratchCreated).toBeGreaterThan(0);
  expect(result.scratchExclusive).toBe(true);
  expect(result.scratchPrivate).toBe(true);
  expect(result.scratchOwned).toBe(true);
  expect(result.scratchCreatedBeforeLaunch).toBe(true);
  expect(result.scratchRemoved).toBe(true);
}

describe("T-0205 independent HTTP context oracle", () => {
  it("C01 healthy native curl entries share the probe shell and BASHPID", () => {
    const result = observations.healthy;
    expect(result.accepted).toBe(true);
    mainContext(result);
    clean(result);
  });

  it("C02 stalled readiness retains 21 native calls and distinguishes pre-launch entries", () => {
    const result = observations.stalled;
    expect(result.accepted).toBe(false);
    expect(result.native.calls).toBe(21);
    expect(result.entries.filter(entry => entry.phase === "pre").length).toBeGreaterThanOrEqual(1);
    expect(result.entries.slice(1)).toHaveLength(20);
    // The listener records arrivals before replying. These are not completed responses.
    expect(result.requests.length).toBeLessThanOrEqual(20);
    expect(result.requests.length).toBeGreaterThan(0);
    for (const code of result.native.statuses.slice(1)) expect([52, 28]).toContain(code);
    expect(result.native.statuses).toContain(28);
    mainContext(result);
    clean(result);
  });

  for (const [name, fixture] of [
    ["C03 scratch is exclusive private and removed after success", "healthy"],
    ["C04 scratch is exclusive private and removed after HTTP refusal", "wrong-credential"],
    ["C05 scratch is exclusive private and removed after stalled readiness", "stalled"],
  ] as const) {
    it(name, () => {
      scratch(observations[fixture]);
      clean(observations[fixture]);
    });
  }

  it("C06 scratch utility refusal occurs before launch and preserves the decoy", () => {
    const result = observations["scratch-refused"];
    expect(result.scratchAttempts).toBeGreaterThan(0);
    expect(result.scratchCreated).toBe(0);
    expect(result.accepted).toBe(false);
    expect(result.probeExit).not.toBe(0);
    clean(result, 0);
  });

  for (const [name, fault] of [
    ["C07 post-native malformed suffix status fails closed", "suffix"],
    ["C08 post-native second-line status fails closed", "second-line"],
    ["C09 post-native partial status fails closed", "partial"],
    ["C10 post-native NUL status fails closed", "nul"],
    ["C11 post-native empty status fails closed", "empty"],
    ["C12 post-native successful-looking status preserves a failing curl exit", "exit"],
    ["C13 post-native closed status stream fails closed", "write-refused"],
    ["C14 per-call capture clears a prior successful-looking status", "stale"],
  ] as const) {
    it(name, () => {
      const result = observations[`fault-${fault}`];
      expect(result.faultControl).toBe(true);
      expect(result.injected).toContain(fault);
      expect(result.native.calls).toBeGreaterThan(0);
      expect(result.completedExits).toHaveLength(result.native.calls);
      if (fault === "exit") {
        expect(result.native.statuses.at(-1)).toBe(0);
        expect(result.returnedExits.at(-1)).toBe(28);
      }
      expect(result.accepted).toBe(false);
      expect(result.probeExit).not.toBe(0);
      scratch(result);
      clean(result);
    });
  }

  for (const [name, fault] of [
    ["C15 status capture preserves one trailing newline", "newline"],
    ["C16 status capture preserves multiple trailing newlines", "newlines"],
  ] as const) {
    it(name, () => {
      const result = observations[`fault-${fault}`];
      expect(result.injected).toEqual([fault]);
      expect(result.accepted).toBe(true);
      mainContext(result);
      scratch(result);
      clean(result);
    });
  }

  it("C17 refused credential and public health remain actual server refusals", () => {
    for (const [fixture, path, status] of [["wrong-credential", "/", 401], ["health-503", "/api/health", 503]] as const) {
      const result = observations[fixture];
      expect(result.faultControl).toBe(false);
      expect(result.injected).toEqual([]);
      expect(result.accepted).toBe(false);
      expect(result.requests).toEqual(expect.arrayContaining([expect.objectContaining({ path, status })]));
      mainContext(result);
      clean(result);
    }
  });

  it("C18 occupied listener retains real 200 401 200 controls and survives refusal", () => {
    const result = observations["occupied-listener"];
    expect(result.listenerControlStatuses).toEqual([200, 401, 200]);
    expect(result.accepted).toBe(false);
    expect([0, 1]).toContain(result.launched);
    expect(result.probeExit).not.toBe(0);
    clean(result, result.launched);
  });

  it("C19 TERM-resistant owned child stops without changing successful probe exit", () => {
    const result = observations.stubborn;
    expect(result.accepted).toBe(true);
    expect(result.probeExit).toBe(0);
    mainContext(result);
    scratch(result);
    clean(result);
  });

  it("C20 unset TMPDIR uses owned fallback scratch and completes native HTTP", () => {
    const result = observations["unset-tmpdir"];
    expect(result.accepted).toBe(true);
    mainContext(result);
    scratch(result);
    clean(result);
  });
});
