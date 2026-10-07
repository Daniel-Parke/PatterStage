/** @jest-environment node */

import { normalizeGitCurrentForBranchesList } from "@/lib/git/git-branch-current";

describe("normalizeGitCurrentForBranchesList", () => {
  it("returns null for empty or HEAD", () => {
    expect(normalizeGitCurrentForBranchesList(["main"], null)).toBeNull();
    expect(normalizeGitCurrentForBranchesList(["main"], "")).toBeNull();
    expect(normalizeGitCurrentForBranchesList(["main"], "   ")).toBeNull();
    expect(normalizeGitCurrentForBranchesList(["main"], "HEAD")).toBeNull();
  });

  it("returns null for detached SHA (7–40 hex)", () => {
    expect(normalizeGitCurrentForBranchesList(["main"], "a1b2c3d")).toBeNull();
    expect(
      normalizeGitCurrentForBranchesList(
        ["main"],
        "abcdef0123456789abcdef0123456789abcdef01",
      ),
    ).toBeNull();
  });

  it("returns null when branch list is non-empty and raw not in list", () => {
    expect(normalizeGitCurrentForBranchesList(["main", "dev"], "feature")).toBeNull();
  });

  it("returns branch name when listed", () => {
    expect(normalizeGitCurrentForBranchesList(["main", "dev"], "dev")).toBe("dev");
  });

  it("allows raw when branches empty (new repo) — still null if HEAD", () => {
    expect(normalizeGitCurrentForBranchesList([], "main")).toBe("main");
    expect(normalizeGitCurrentForBranchesList([], "HEAD")).toBeNull();
  });
});
