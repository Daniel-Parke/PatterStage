/** @jest-environment node */
// BD1: benchmark gateway manager — capability detection + endpoint resolution.
// (The spawn/health lifecycle is exercised end-to-end in the combined CH+Hermes
// image; here we lock the pure, deterministic surface.)

import {
  resolveHermesBin,
  gatewaySpawnAvailable,
  getBenchGatewayEndpoint,
  getBenchGatewayKey,
  _resetHermesBinCache,
} from "@/lib/runtime/gateway-manager";

describe("gateway-manager — capability detection", () => {
  const original = process.env.HERMES_BIN;
  afterEach(() => {
    if (original === undefined) delete process.env.HERMES_BIN;
    else process.env.HERMES_BIN = original;
    _resetHermesBinCache();
  });

  it("resolves an explicit HERMES_BIN that points at a real executable", () => {
    process.env.HERMES_BIN = process.execPath; // node itself is executable
    _resetHermesBinCache();
    expect(resolveHermesBin()).toBe(process.execPath);
    expect(gatewaySpawnAvailable()).toBe(true);
  });

  it("returns null (unavailable) when HERMES_BIN points nowhere", () => {
    process.env.HERMES_BIN = "/definitely/not/a/real/hermes/binary";
    _resetHermesBinCache();
    expect(resolveHermesBin()).toBeNull();
    expect(gatewaySpawnAvailable()).toBe(false);
  });
});

describe("gateway-manager — endpoint resolution falls through when nothing is live", () => {
  it("returns null for a profile with no spawned gateway", () => {
    expect(getBenchGatewayEndpoint("__bench_nope")).toBeNull();
    expect(getBenchGatewayKey("__bench_nope")).toBeNull();
  });
});
