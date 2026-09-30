/** @jest-environment node */

import { spawnSync as runFixture } from "node:child_process";
import { resolve as absolutePath } from "node:path";
import { resolveDataDir } from "@/lib/host/paths";

type DefaultObservation = {
  accepted: boolean;
  requests: { path: string; credential: string; status: number }[];
  defaults: {
    platform: string; homeOwned: boolean; dataEnvironmentAbsent: boolean; dotenvKeys: string[];
    tokenRelativePath: string; fileCredential: string; databaseName: string | null;
    lowerDirectoryExists: boolean; physicalCaseDistinct: boolean; staleTokenDistinct: boolean;
    lowerHasDatabase: boolean;
  };
};
let defaults: Record<string, DefaultObservation>;

beforeAll(() => {
  const probe = runFixture(process.env.PYTHON || "python", [
    absolutePath("tests/helpers/release-install-http-probe.py"),
    "default-control", "default-fresh", "default-uppercase-db",
    "default-uppercase-legacy-db", "default-wrong-token", "default-wrong-control",
  ], { encoding: "utf8", timeout: 90_000, maxBuffer: 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
  if (probe.error || probe.status !== 0) {
    throw new Error(`Default fixture infrastructure failed (${probe.status}): ${probe.error?.message ?? probe.stderr}`);
  }
  defaults = JSON.parse(probe.stdout) as Record<string, DefaultObservation>;
}, 100_000);

function assertDefaultFixture(result: DefaultObservation): void {
  expect(result.defaults).toMatchObject({ homeOwned: true, dataEnvironmentAbsent: true, dotenvKeys: ["PORT"] });
  expect(result).toMatchObject({ executions: 1, launched: 1, ownedStopped: true, decoySurvived: true,
    signalsOwned: true, withinDeadline: true, requestsBounded: true,
    credentialLeaked: false, scriptContainsCredential: false });
}

function assertResponses(result: DefaultObservation, credential: "valid" | "wrong", status: number): void {
  expect(result.requests).toEqual(expect.arrayContaining([
    { path: "/api/health", credential: "absent", status: 200 },
    { path: "/", credential: "absent", status: 401 },
    { path: "/", credential, status },
  ]));
  assertDefaultFixture(result);
}

describe("T-0202 default install HTTP probe", () => {
  it("D00 default fixture control serves 200/401/200 from its owned HOME", () => {
    const control = defaults["default-control"];
    expect(control.accepted).toBe(true);
    assertResponses(control, "valid", 200);
  });

  it("D01 accepts a fresh default install with only PORT and a file token", () => {
    const fresh = defaults["default-fresh"];
    expect(fresh.defaults).toMatchObject({ tokenRelativePath: "patterstage/data/auth-token", databaseName: null });
    expect(fresh.accepted).toBe(true);
    assertResponses(fresh, "valid", 200);
  });

  for (const [name, fixture, databaseName] of [
    ["D02 prefers uppercase patterstage.db over a stale lowercase token", "default-uppercase-db", "patterstage.db"],
    ["D03 prefers uppercase control-hub.db over a stale lowercase token", "default-uppercase-legacy-db", "control-hub.db"],
  ] as const) {
    it(name, () => {
      const populated = defaults[fixture];
      expect(populated.defaults).toMatchObject({ tokenRelativePath: "PatterStage/data/auth-token", databaseName,
        lowerDirectoryExists: true });
      // NTFS aliases these directories. Linux separately proves distinct stale storage.
      const distinct = populated.defaults.platform !== "nt";
      expect(populated.defaults.physicalCaseDistinct).toBe(distinct);
      expect(populated.defaults.staleTokenDistinct).toBe(distinct);
      expect(populated.defaults.lowerHasDatabase).toBe(!distinct);
      expect(populated.accepted).toBe(true);
      assertResponses(populated, "valid", 200);
    });
  }

  it("D04 rejects the wrong default file token after a real authenticated request", () => {
    const refused = defaults["default-wrong-token"];
    expect(refused.defaults.fileCredential).toBe("wrong");
    expect(refused.accepted).toBe(false);
    assertResponses(refused, "wrong", 401);
  });

  it("D05 default fixture wrong-token control serves 200/401/401", () => {
    const negative = defaults["default-wrong-control"];
    expect(negative.accepted).toBe(true); // Fixture executed; its authenticated request was refused.
    assertResponses(negative, "wrong", 401);
  });

  it("D06 runtime discovery selects a populated uppercase path over an existing empty lowercase path", () => {
    const home = "/owned-home";
    const populated = `${home}/PatterStage/data`;
    const stale = `${home}/patterstage/data`;
    expect(resolveDataDir(home, (candidate) => candidate === populated,
      (candidate) => candidate === populated || candidate === stale)).toBe(populated);
    expect(resolveDataDir(home, () => false, (candidate) => candidate === stale)).toBe(stale);
    expect(resolveDataDir(home, () => false, () => false)).toBe(stale);
  });
});
