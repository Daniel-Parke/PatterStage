/** @jest-environment node */

// L — the Scripts manager exec path is security-critical: only *.sh files that
// live DIRECTLY under the scripts dir may resolve. Traversal, nested paths, and
// non-.sh names must be rejected (so run-now can never reach an arbitrary file).

jest.mock("@/lib/paths", () => ({
  getPsScriptsDir: () => "/data/scripts",
  getPsHardwareLogDir: () => "/data/logs",
}));

const existsSync = jest.fn(() => true);
jest.mock("fs", () => ({
  existsSync: () => existsSync(),
  readdirSync: jest.fn(() => []),
  statSync: jest.fn(),
  readFileSync: jest.fn(),
  appendFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

import { resolveScriptPath } from "@/lib/scripts-manager";

beforeEach(() => {
  existsSync.mockReturnValue(true);
});

describe("resolveScriptPath — path safety", () => {
  it("accepts a plain .sh name under the scripts dir", () => {
    const r = resolveScriptPath("ch-backup.sh");
    expect(r).not.toBeNull();
    // Normalise separators — the dev box is Windows, the target is Linux.
    expect(r!.replace(/\\/g, "/")).toBe("/data/scripts/ch-backup.sh");
  });

  it("rejects parent traversal", () => {
    expect(resolveScriptPath("../etc/passwd.sh")).toBeNull();
    expect(resolveScriptPath("..")).toBeNull();
  });

  it("rejects nested paths (forward + back slash)", () => {
    expect(resolveScriptPath("sub/evil.sh")).toBeNull();
    expect(resolveScriptPath("sub\\evil.sh")).toBeNull();
  });

  it("rejects non-.sh files", () => {
    expect(resolveScriptPath("ch-backup.txt")).toBeNull();
    expect(resolveScriptPath("passwd")).toBeNull();
  });

  it("rejects empty / missing", () => {
    expect(resolveScriptPath("")).toBeNull();
    existsSync.mockReturnValue(false);
    expect(resolveScriptPath("ghost.sh")).toBeNull();
  });
});
