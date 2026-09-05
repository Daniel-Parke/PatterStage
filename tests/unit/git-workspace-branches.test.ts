/** @jest-environment node */

import { readGitBranchMetadataForWorkspacePath } from "@/lib/git/git-workspace-branches";

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

describe("readGitBranchMetadataForWorkspacePath", () => {
  it("returns non-git when .git marker is missing", async () => {
    const exec = jest.fn();
    const exists = jest.fn().mockReturnValue(false);
    const r = await readGitBranchMetadataForWorkspacePath("/repo", exec, exists);
    expect(r).toEqual({ isGitRepo: false, branches: [], current: null });
    expect(exec).not.toHaveBeenCalled();
  });

  it("parses branches and coerces rev-parse HEAD to current null", async () => {
    const exists = jest.fn().mockReturnValue(true);
    const exec = jest.fn(async (_file: string, args: string[]) => {
      const j = args.join(" ");
      if (j.includes("branch --format=%(refname:short)")) {
        return { stdout: "main\ndev\n" };
      }
      if (j.includes("rev-parse")) {
        return { stdout: "HEAD\n" };
      }
      return { stdout: "" };
    });
    const r = await readGitBranchMetadataForWorkspacePath("/repo", exec, exists);
    expect(r.isGitRepo).toBe(true);
    expect(r.branches).toEqual(["main", "dev"]);
    expect(r.current).toBeNull();
  });

  it("empty repo: no branches, current null", async () => {
    const exists = jest.fn().mockReturnValue(true);
    const exec = jest.fn(async (_file: string, args: string[]) => {
      const j = args.join(" ");
      if (j.includes("branch --format=%(refname:short)")) {
        return { stdout: "" };
      }
      if (j.includes("rev-parse")) {
        return { stdout: "HEAD\n" };
      }
      return { stdout: "" };
    });
    const r = await readGitBranchMetadataForWorkspacePath("/repo", exec, exists);
    expect(r.branches).toEqual([]);
    expect(r.current).toBeNull();
  });

  it("detached short SHA from rev-parse yields current null", async () => {
    const exists = jest.fn().mockReturnValue(true);
    const exec = jest.fn(async (_file: string, args: string[]) => {
      const j = args.join(" ");
      if (j.includes("branch --format=%(refname:short)")) {
        return { stdout: "main\n" };
      }
      if (j.includes("rev-parse")) {
        return { stdout: "a1b2c3d\n" };
      }
      return { stdout: "" };
    });
    const r = await readGitBranchMetadataForWorkspacePath("/repo", exec, exists);
    expect(r.current).toBeNull();
  });

  it("swallows git branch failure and returns empty branches", async () => {
    const exists = jest.fn().mockReturnValue(true);
    const exec = jest.fn(async (_file: string, args: string[]) => {
      const j = args.join(" ");
      if (j.includes("branch --format=%(refname:short)")) {
        throw new Error("git missing");
      }
      if (j.includes("rev-parse")) {
        return { stdout: "main\n" };
      }
      return { stdout: "" };
    });
    const r = await readGitBranchMetadataForWorkspacePath("/repo", exec, exists);
    expect(r.branches).toEqual([]);
  });
});
