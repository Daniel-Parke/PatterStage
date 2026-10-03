import { MAX_DEPLOY_GIT_BRANCH_LEN, sanitizeGitBranch } from "@/lib/git/git-branch";

describe("sanitizeGitBranch (shared with POST /api/update + Sidebar)", () => {
  it("strips unsafe characters", () => {
    expect(sanitizeGitBranch("feat;rm")).toBe("featrm");
  });

  it("truncates length", () => {
    const long = "a".repeat(300);
    expect(sanitizeGitBranch(long).length).toBe(MAX_DEPLOY_GIT_BRANCH_LEN);
  });

  it("falls back to dev when empty after strip", () => {
    expect(sanitizeGitBranch(";;;")).toBe("dev");
  });
});
