/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

type Request = { path: string; credential: "absent" | "valid" | "wrong"; status: number };
type Observation = {
  accepted: boolean; executions: number; launched: number; ownedStopped: boolean;
  decoySurvived: boolean; signalsOwned: boolean; withinDeadline: boolean;
  requestsBounded: boolean; credentialLeaked: boolean; scriptContainsCredential: boolean;
  workspaceHasSpaces: boolean; listenerControlStatuses: number[]; requests: Request[];
};
let observations: Record<string, Observation>;

beforeAll(() => {
  const result = spawnSync(process.env.PYTHON || "python", [resolve("tests/helpers/release-install-http-probe.py")], {
    cwd: process.cwd(), encoding: "utf8", timeout: 150_000, maxBuffer: 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  // Infrastructure errors have no matcherResult and cannot count as kills.
  if (result.error || result.status !== 0) throw new Error(`T-0202 fixture infrastructure failed (${result.status}): ${result.error?.message ?? result.stderr}`);
  observations = JSON.parse(result.stdout) as Record<string, Observation>;
}, 160_000);

function clean(result: Observation, requestsExpected = true, launchOptional = false): void {
  expect(result.executions).toBeGreaterThan(0);
  if (launchOptional) expect([0, 1]).toContain(result.launched);
  else expect(result.launched).toBe(1);
  expect(result.ownedStopped).toBe(true);
  expect(result.decoySurvived).toBe(true);
  expect(result.signalsOwned).toBe(true);
  expect(result.withinDeadline).toBe(true);
  if (requestsExpected) expect(result.requestsBounded).toBe(true);
  expect(result.credentialLeaked).toBe(false);
  expect(result.scriptContainsCredential).toBe(false);
}

describe("T-0202 release HTTP probe", () => {
  it("F00 fixture control launches, serves 200/401/200 and stops only its owned process", () => {
    const result = observations.control;
    expect(result.accepted).toBe(true);
    expect(result.requests).toEqual([
      { path: "/api/health", credential: "absent", status: 200 },
      { path: "/", credential: "absent", status: 401 },
      { path: "/", credential: "valid", status: 200 },
    ]);
    clean(result);
  });

  it("H01 accepts public health 200, anonymous 401 and authenticated 200 with owned cleanup", () => {
    const result = observations.healthy;
    expect(result.workspaceHasSpaces).toBe(true);
    expect(result.accepted).toBe(true);
    expect(result.requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "/api/health", credential: "absent", status: 200 }),
      expect.objectContaining({ path: "/", credential: "absent", status: 401 }),
      expect.objectContaining({ path: "/", credential: "valid", status: 200 }),
    ]));
    clean(result);
  });

  for (const [name, fixture, path, credential, status] of [
    ["H02 rejects a credential refused by the server", "wrong-credential", "/", "valid", 401],
    ["H03 rejects anonymous protected access returning 200", "anonymous-200", "/", "absent", 200],
    ["H04 rejects public health 204", "health-204", "/api/health", "absent", 204],
    ["H05 rejects public health 503", "health-503", "/api/health", "absent", 503],
    ["H06 rejects a public health redirect", "health-redirect", "/api/health", "absent", 302],
    ["H07 rejects an anonymous protected redirect", "anonymous-redirect", "/", "absent", 302],
    ["H08 rejects an authenticated protected redirect", "auth-redirect", "/", "valid", 302],
    ["H09 rejects authenticated protected access returning 403", "auth-403", "/", "valid", 403],
  ] as const) {
    it(name, () => {
      const result = observations[fixture];
      expect(result.requests).toEqual(expect.arrayContaining([expect.objectContaining({ path, credential, status })]));
      expect(result.accepted).toBe(false);
      clean(result);
    });
  }

  for (const [name, fixture] of [
    ["H10 rejects a dead launch", "dead-launch"],
    ["H11 rejects an occupied listener and preserves the unrelated process", "occupied-listener"],
  ] as const) {
    it(name, () => {
      const result = observations[fixture];
      if (fixture === "occupied-listener") expect(result.listenerControlStatuses).toEqual([200, 401, 200]);
      expect(result.accepted).toBe(false);
      clean(result, false, fixture === "occupied-listener");
    });
  }

  it("H12 bounds stalled HTTP requests and cleans up without the fixture watchdog", () => {
    const result = observations.stalled;
    expect(result.requests.length).toBeGreaterThan(0);
    expect(result.accepted).toBe(false);
    clean(result);
  });

  it("H13 bounds cleanup of a launched process that ignores TERM", () => {
    const result = observations.stubborn;
    expect(result.accepted).toBe(true);
    clean(result);
  });
});
