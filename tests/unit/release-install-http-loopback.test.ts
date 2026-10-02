/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

type Observation = {
  accepted: boolean; executions: number; launched: number; ownedStopped: boolean;
  decoySurvived: boolean; signalsOwned: boolean; withinDeadline: boolean;
  requestsBounded: boolean; credentialLeaked: boolean; scriptContainsCredential: boolean;
  requests: { path: string; credential: string; status: number }[];
  listenerControlStatuses: number[]; resolverCalls: string[]; elapsedSeconds: number;
  listenerSocketsClosed: boolean; listenerThreadsStopped: boolean; requestsThreaded: boolean;
  restored: boolean;
  listeners: { requestedAddress: string; requestedPort: number; boundAddress: string;
    boundPort: number; serverAddress: [string, number]; serverName: string; serverPort: number;
    family: number; socketType: number; accepting: boolean; reuseAddress: boolean }[];
  native: { calls: number; errors: number; cancelled: number; statuses: number[];
    clientHashes: string[]; environmentRegistered: boolean; ownedCurlStopped: boolean;
    listenerStopped: boolean; ipcStopped: boolean; socketClosed: boolean }[];
};
type Report = {
  calibration: { directValue: string; directCalls: number; constructorCalls: string[];
    externalAttempts: number; boundAddress: string; boundPort: number;
    socketClosed: boolean; restored: boolean };
  cases: Record<string, Observation>;
};
let report: Report;

beforeAll(() => {
  const owned = mkdtempSync(join(tmpdir(), "t0205-loopback-env-"));
  // Carry only process/tool essentials. All data, home and temporary paths are owned.
  const environment: NodeJS.ProcessEnv = {};
  for (const name of ["PATH", "Path", "PATHEXT", "SystemRoot", "SYSTEMROOT", "WINDIR", "COMSPEC"]) {
    if (process.env[name]) environment[name] = process.env[name];
  }
  Object.assign(environment, { HOME: owned, USERPROFILE: owned, TEMP: owned, TMP: owned,
    TMPDIR: owned, PS_DATA_DIR: owned, CH_DATA_DIR: owned, HERMES_HOME: owned,
    PYTHONDONTWRITEBYTECODE: "1", PYTHONIOENCODING: "utf-8" });
  try {
    const result = spawnSync(process.env.PYTHON || "python", [resolve("tests/helpers/release-install-http-loopback-probe.py")], {
      cwd: process.cwd(), encoding: "utf8", timeout: 150_000, maxBuffer: 1024 * 1024,
      env: environment,
    });
    if (result.error || result.status !== 0) throw new Error(`T-0205 loopback observer infrastructure failed (${result.status})`);
    report = JSON.parse(result.stdout) as Report;
  } finally {
    rmSync(owned, { recursive: true, force: true });
  }
}, 160_000);

function realNative(result: Observation, minimumCalls = 3): void {
  expect(result.native).toHaveLength(1);
  const transport = result.native[0];
  expect(transport.calls).toBeGreaterThanOrEqual(minimumCalls);
  expect(transport.statuses).toHaveLength(transport.calls);
  expect(transport.clientHashes).toEqual([expect.stringMatching(/^[a-f0-9]{64}$/)]);
  expect(transport.environmentRegistered).toBe(true);
  expect(transport.errors).toBe(0);
  expect(transport.cancelled).toBe(0);
  expect(result.requestsBounded).toBe(true);
  expect(result.requestsThreaded).toBe(true);
}

function clean(result: Observation): void {
  expect(result.executions).toBe(1);
  expect(result.ownedStopped).toBe(true);
  expect(result.decoySurvived).toBe(true);
  expect(result.signalsOwned).toBe(true);
  expect(result.withinDeadline).toBe(true);
  expect(result.elapsedSeconds).toBeLessThan(25);
  expect(result.credentialLeaked).toBe(false);
  expect(result.scriptContainsCredential).toBe(false);
  expect(result.listenerSocketsClosed).toBe(true);
  expect(result.listenerThreadsStopped).toBe(true);
  expect(result.restored).toBe(true);
  for (const transport of result.native) {
    expect(transport.ownedCurlStopped).toBe(true);
    expect(transport.listenerStopped).toBe(true);
    expect(transport.ipcStopped).toBe(true);
    expect(transport.socketClosed).toBe(true);
  }
}

describe("T-0205 independent loopback binding oracle", () => {
  it("L01 resolver sentinel detects the stdlib constructor without actual DNS", () => {
    const result = report.calibration;
    expect(result.directValue).toBe("127.0.0.1");
    expect(result.directCalls).toBe(1);
    expect(result.constructorCalls).toEqual(["127.0.0.1"]);
    expect(result.externalAttempts).toBe(0);
    expect(result.boundAddress).toBe("127.0.0.1");
    expect(result.boundPort).toBeGreaterThan(0);
    expect(result.socketClosed).toBe(true);
    expect(result.restored).toBe(true);
  });

  it("L02 literal loopback binding performs zero resolver calls during actual native HTTP", () => {
    for (const [name, result] of Object.entries(report.cases)) {
      realNative(result, name === "occupied-listener" ? 1 : 3);
      clean(result);
      expect(result.resolverCalls).toEqual([]);
    }
  });

  it("L03 activated threaded listener metadata matches its actual numeric bound address and port", () => {
    for (const result of Object.values(report.cases)) {
      expect(result.listeners).toHaveLength(1);
      const listener = result.listeners[0];
      expect(listener.requestedAddress).toBe("127.0.0.1");
      expect(listener.requestedPort).toBe(0);
      expect(listener.boundAddress).toBe("127.0.0.1");
      expect(listener.boundPort).toBeGreaterThan(0);
      expect(listener.boundPort).toBeLessThanOrEqual(65535);
      expect(listener.serverAddress).toEqual([listener.boundAddress, listener.boundPort]);
      expect(listener.serverName).toBe(listener.boundAddress);
      expect(listener.serverPort).toBe(listener.boundPort);
      // Python AF_INET and SOCK_STREAM are portable values 2 and 1.
      expect(listener.family).toBe(2);
      expect(listener.socketType).toBe(1);
      expect(listener.accepting).toBe(true);
      expect(listener.reuseAddress).toBe(true);
      expect(result.requestsThreaded).toBe(true);
    }
  });

  it("L04 independent control and healthy probe retain real public 200 anonymous 401 authenticated 200", () => {
    for (const name of ["control", "healthy"]) {
      const result = report.cases[name];
      expect(result.accepted).toBe(true);
      expect(result.launched).toBe(1);
      expect(result.requests).toEqual(expect.arrayContaining([
        { path: "/api/health", credential: "absent", status: 200 },
        { path: "/", credential: "absent", status: 401 },
        { path: "/", credential: "valid", status: 200 },
      ]));
      realNative(result);
      clean(result);
    }
  });

  it("L05 actual authenticated 401 refuses the probe and preserves owned cleanup", () => {
    const result = report.cases["wrong-credential"];
    expect(result.accepted).toBe(false);
    expect(result.launched).toBe(1);
    expect(result.requests).toContainEqual({ path: "/", credential: "valid", status: 401 });
    realNative(result);
    clean(result);
  });

  it("L06 occupied listener retains real 200 401 200 and survives the probe refusal", () => {
    const result = report.cases["occupied-listener"];
    expect(result.accepted).toBe(false);
    expect([0, 1]).toContain(result.launched);
    expect(result.listenerControlStatuses).toEqual([200, 401, 200]);
    expect(result.requests).toEqual(expect.arrayContaining([
      { path: "/api/health", credential: "absent", status: 200 },
      { path: "/", credential: "absent", status: 401 },
      { path: "/", credential: "valid", status: 200 },
    ]));
    expect(result.native[0].calls).toBeGreaterThan(0);
    expect(result.native[0].errors).toBe(0);
    expect(result.requestsThreaded).toBe(true);
    clean(result);
  });

  it("L07 TERM resistant owned child stops while successful native HTTP and decoy survive", () => {
    const result = report.cases.stubborn;
    expect(result.accepted).toBe(true);
    expect(result.launched).toBe(1);
    realNative(result);
    clean(result);
  });
});
