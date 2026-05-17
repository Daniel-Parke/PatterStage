/**
 * buildMissionPrompt round-trip tests:
 * build → stripPromptSections → instruction should be preserved.
 * Also verifies the new MISSION SCOPE and SAFETY LIMITS sections.
 */

import { buildMissionPrompt, stripPromptSections } from "@/lib/build-mission-prompt";

describe("buildMissionPrompt → stripPromptSections round-trip", () => {
  it("preserves instruction through build+strip", () => {
    const instruction = "Refactor the authentication module to use JWT.";
    const prompt = buildMissionPrompt({
      instruction,
      localDirs: ["/repo"],
      references: ["README.md"],
      skills: ["refactoring-patterns"],
      goals: ["Read & understand", "Plan refactor", "Execute refactor"],
      context: "The module lives in src/auth/",
    });
    const { instruction: stripped } = stripPromptSections(prompt);
    expect(stripped).toBe(instruction);
  });

  it("preserves context through build+strip", () => {
    const context = "Background: the auth module is 3 years old and needs cleanup.";
    const prompt = buildMissionPrompt({
      instruction: "Do the thing",
      context,
    });
    const { context: strippedContext } = stripPromptSections(prompt);
    expect(strippedContext).toBe(context);
  });

  it("injects MISSION SCOPE when missionTimeMinutes is set", () => {
    const prompt = buildMissionPrompt({
      instruction: "Fix the bug",
      missionTimeMinutes: 120,
    });
    expect(prompt).toContain("## MISSION SCOPE");
    expect(prompt).toContain("120 minutes");
    expect(prompt).toContain("2.0 developer hours");
    expect(prompt).toContain("Planning horizon:");
    expect(prompt).toContain("SOFT GUIDE");
  });

  it("omits MISSION SCOPE when missionTimeMinutes is absent", () => {
    const prompt = buildMissionPrompt({
      instruction: "Fix the bug",
    });
    expect(prompt).not.toContain("## MISSION SCOPE");
    expect(prompt).not.toContain("Planning horizon");
  });

  it("injects SAFETY LIMITS when timeoutMinutes is set", () => {
    const prompt = buildMissionPrompt({
      instruction: "Investigate the outage",
      timeoutMinutes: 30,
    });
    expect(prompt).toContain("## SAFETY LIMITS");
    expect(prompt).toContain("Inactivity timeout: 30 minutes");
    expect(prompt).toContain("Each tool call resets the timer");
  });

  it("omits SAFETY LIMITS when timeoutMinutes is absent", () => {
    const prompt = buildMissionPrompt({
      instruction: "Investigate the outage",
    });
    expect(prompt).not.toContain("## SAFETY LIMITS");
    expect(prompt).not.toContain("Inactivity timeout");
  });

  it("strips MISSION SCOPE and SAFETY LIMITS via stripPromptSections", () => {
    const prompt = buildMissionPrompt({
      instruction: "Deploy the release",
      missionTimeMinutes: 60,
      timeoutMinutes: 45,
    });
    const { instruction } = stripPromptSections(prompt);
    // Original prompt has both SCOPE and SAFETY sections
    expect(prompt).toContain("## MISSION SCOPE");
    expect(prompt).toContain("## SAFETY LIMITS");
    // Stripped prompt contains only the instruction
    expect(instruction).toBe("Deploy the release");
  });

  it("handles zero missionTimeMinutes as absent (no scope block)", () => {
    const prompt = buildMissionPrompt({
      instruction: "Do it",
      missionTimeMinutes: 0,
    });
    expect(prompt).not.toContain("## MISSION SCOPE");
  });

  it("handles zero timeoutMinutes as absent (no safety block)", () => {
    const prompt = buildMissionPrompt({
      instruction: "Do it",
      timeoutMinutes: 0,
    });
    expect(prompt).not.toContain("## SAFETY LIMITS");
  });

  it("build+strip round-trips multiple options at once", () => {
    const instruction = "Run a full deployment pipeline check.";
    const context = "We are on the staging environment.";
    const prompt = buildMissionPrompt({
      instruction,
      context,
      localDirs: [{ path: "/workspace/deploy" }],
      skills: ["devops"],
      goals: ["Verify infra", "Deploy", "Run smoke tests"],
      missionTimeMinutes: 90,
      timeoutMinutes: 60,
    });
    const result = stripPromptSections(prompt);
    expect(result.instruction).toBe(instruction);
    expect(result.context).toBe(context);
  });
});
