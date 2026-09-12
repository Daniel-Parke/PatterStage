/** @jest-environment node */
/**
 * B1 (T-0095), D107: `checkVersion` answers every failure with an "unknown"
 * record whose `updateAvailable` is false, and the footer reads only that flag,
 * so a `git fetch` that could not reach origin painted the button green and
 * "Up to Date". Not knowing is a fourth state, and it is named.
 */
import { rmSync } from "fs";

const mockRunGit = jest.fn();
// The temp dir is minted INSIDE the factory: jest hoists jest.mock above every
// import and const, so a module-level value read here is in its temporal dead
// zone (the trap the round-6 paths test fell into).
jest.mock("@/lib/update-handlers/shared", () => {
  const { mkdtempSync } = jest.requireActual("fs") as typeof import("fs");
  const { tmpdir } = jest.requireActual("os") as typeof import("os");
  const { join } = jest.requireActual("path") as typeof import("path");
  const dir = mkdtempSync(join(tmpdir(), "ps-version-check-"));
  return {
    __CACHE_DIR: dir,
    CACHE_FILE: join(dir, "version-cache.json"),
    CACHE_TTL_MS: 300_000,
    UPDATE_BRANCH: "dev",
    runGit: (...a: unknown[]) => mockRunGit(...a),
  };
});

import { checkVersion } from "@/lib/update-handlers/version-check";
import * as shared from "@/lib/update-handlers/shared";

afterAll(() =>
  rmSync((shared as unknown as { __CACHE_DIR: string }).__CACHE_DIR, { recursive: true, force: true }),
);
beforeEach(() => mockRunGit.mockReset());

describe("checkVersion", () => {
  it("says checkFailed when git could not answer, and does not claim up to date", () => {
    mockRunGit.mockImplementation(() => {
      throw new Error("fatal: unable to access 'https://github.com/': Could not resolve host");
    });
    const v = checkVersion("dev");
    expect(v.checkFailed).toBe(true);
    expect(v.updateAvailable).toBe(false);
    expect(v.localHash).toBe("unknown");
  });

  it("GREEN CONTROL: a successful compare is checkFailed:false", () => {
    mockRunGit.mockImplementation((args: string[]) => {
      if (args[0] === "fetch") return "";
      if (args[0] === "rev-parse" && args[1] === "HEAD") return "aaaaaaa1111";
      if (args[0] === "rev-parse" && args[1] === "origin/dev") return "aaaaaaa1111";
      if (args[0] === "rev-parse") return "dev";
      return "";
    });
    const v = checkVersion("dev");
    expect(v.checkFailed).toBe(false);
    expect(v.updateAvailable).toBe(false);
    expect(v.localHash).toBe("aaaaaaa");
  });
});
