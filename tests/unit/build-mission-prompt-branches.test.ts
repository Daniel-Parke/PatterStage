import { buildMissionPrompt } from "@/lib/mission-repository";

describe("buildMissionPrompt localDirs branches", () => {
  it("renders branch hint for LocalDirEntry", () => {
    const p = buildMissionPrompt({
      instruction: "Do work",
      localDirs: [{ path: "/repo", branch: "feature/x" }],
      references: [],
      skills: [],
      goals: [],
      context: "",
    });
    expect(p).toContain("## Working Directories");
    expect(p).toContain("/repo");
    expect(p).toContain("(branch: feature/x)");
  });

  it("accepts legacy string[] dirs", () => {
    const p = buildMissionPrompt({
      instruction: "X",
      localDirs: ["/only"],
      references: [],
      skills: [],
      goals: [],
      context: "",
    });
    expect(p).toContain("/only");
    expect(p).not.toContain("(branch:");
  });
});
