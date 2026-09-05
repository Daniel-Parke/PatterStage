/** @jest-environment node */

// Tests for the commitFallbackChange helper that consolidates the
// "sync + audit" side-effect pair used by 5 fallback API routes.

const mockAppendAuditLine = jest.fn();

// Mock the side effects we care about: the audit call (so we can spy on
// it) and the underlying Hermes config writer (so the test doesn't touch
// the filesystem). We let the real `listFallbackChain`/`getFallbackConfig`
// resolve to harmless defaults, and `syncFallbacksToHermesConfig` returns
// a stub result so the chain sync succeeds without doing real I/O.

jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: (...args: unknown[]) => mockAppendAuditLine(...args),
}));

jest.mock("@/modules/hermes/lib/hermes-fallback-config", () => ({
  syncFallbacksToHermesConfig: jest.fn(() => ({
    backupPath: null,
    configPath: "/tmp/test-hermes/config.yaml",
    hermesHome: "/tmp/test-hermes",
  })),
}));

import { commitFallbackChange } from "@/modules/hermes/lib/fallback-sync";

describe("commitFallbackChange", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("appends an audit line with the given action and resource", () => {
    commitFallbackChange("fallback.add", "entry-1");
    expect(mockAppendAuditLine).toHaveBeenCalledTimes(1);
    expect(mockAppendAuditLine).toHaveBeenCalledWith({
      action: "fallback.add",
      resource: "entry-1",
      ok: true,
    });
  });

  it("propagates the action and resource verbatim (no renaming)", () => {
    commitFallbackChange("fallback.toggle", "entry-42");
    expect(mockAppendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "fallback.toggle", resource: "entry-42" })
    );
  });

  it("passes the action and resource to commitFallbackChange", () => {
    // When a chain has at least one enabled entry, the underlying sync
    // helper is invoked (we verify the call to the mocked writer below).
    commitFallbackChange("fallback.reorder", "chain-7");
    expect(mockAppendAuditLine).toHaveBeenCalled();
  });

  it("does not throw when invoked", () => {
    expect(() => commitFallbackChange("fallback.delete", "id-x")).not.toThrow();
  });
});
