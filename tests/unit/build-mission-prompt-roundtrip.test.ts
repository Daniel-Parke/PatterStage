/**
 * buildMissionPrompt / parseMissionPrompt / buildMissionPromptHuman tests.
 */

import {
  buildMissionPrompt,
  buildMissionPromptHuman,
  parseMissionPrompt,
} from "@/lib/missions/build-mission-prompt";

const baseOpts = {
  instruction: "Refactor the authentication module to use JWT.",
  localDirs: ["/repo"],
  references: ["README.md"],
  skills: ["refactoring-patterns"],
  goals: ["Read & understand", "Plan refactor"],
  context: "The module lives in src/auth/",
  outputFormat: "Markdown summary plus file list.",
  constraints: "Do not modify tests/ without approval.",
  missionTimeMinutes: 120,
  timeoutMinutes: 30,
};

describe("buildMissionPrompt (AI XML)", () => {
  it("wraps prompt in hermes_mission with mission_brief first and task last", () => {
    const prompt = buildMissionPrompt(baseOpts);
    expect(prompt).toMatch(/^<hermes_mission>/);
    expect(prompt).toMatch(/<\/hermes_mission>$/);
    expect(prompt.indexOf("<mission_brief>")).toBeLessThan(
      prompt.indexOf("<task>"),
    );
    expect(prompt.lastIndexOf("<task>")).toBeGreaterThan(
      prompt.indexOf("<constraints"),
    );
  });

  it("does not use --- delimiters", () => {
    const prompt = buildMissionPrompt(baseOpts);
    expect(prompt).not.toMatch(/\n---\n/);
  });

  it("uses CDATA for user-authored sections", () => {
    const prompt = buildMissionPrompt(baseOpts);
    expect(prompt).toContain("<task><![CDATA[");
    expect(prompt).toContain("<additional_context><![CDATA[");
    expect(prompt).toContain("<expected_output><![CDATA[");
    expect(prompt).toContain('<constraints binding="hard"><![CDATA[');
  });

  it("omits empty optional tags", () => {
    const prompt = buildMissionPrompt({ instruction: "Only task." });
    expect(prompt).not.toContain("<working_directories>");
    expect(prompt).not.toContain("<goals>");
    expect(prompt).toContain("<mission_brief>");
    expect(prompt).toContain("<task>");
  });

  it("includes mission_scope and safety_limits when set", () => {
    const prompt = buildMissionPrompt({
      instruction: "Fix bug",
      missionTimeMinutes: 120,
      timeoutMinutes: 30,
    });
    expect(prompt).toContain("<mission_scope>");
    expect(prompt).toContain("120 minutes");
    expect(prompt).toContain("<safety_limits>");
    expect(prompt).toContain("Inactivity timeout: 30 minutes");
  });

  it("omits scope and safety when zero or absent", () => {
    const prompt = buildMissionPrompt({
      instruction: "Fix bug",
      missionTimeMinutes: 0,
      timeoutMinutes: 0,
    });
    expect(prompt).not.toContain("<mission_scope>");
    expect(prompt).not.toContain("<safety_limits>");
  });

  it("escapes CDATA break sequences in user content", () => {
    const prompt = buildMissionPrompt({
      instruction: "Use ]]>",
    });
    expect(prompt).toContain("]]]]><![CDATA[>");
    expect(parseMissionPrompt(prompt).instruction).toBe("Use ]]>");
  });
});

describe("parseMissionPrompt round-trip", () => {
  it("preserves instruction, context, output, constraints", () => {
    const prompt = buildMissionPrompt(baseOpts);
    const parsed = parseMissionPrompt(prompt);
    expect(parsed.instruction).toBe(baseOpts.instruction);
    expect(parsed.context).toBe(baseOpts.context);
    expect(parsed.outputFormat).toBe(baseOpts.outputFormat);
    expect(parsed.constraints).toBe(baseOpts.constraints);
  });

  it("returns raw string as instruction when not XML", () => {
    const parsed = parseMissionPrompt("Plain old instruction");
    expect(parsed.instruction).toBe("Plain old instruction");
    expect(parsed.context).toBe("");
  });
});

describe("buildMissionPromptHuman", () => {
  it("uses markdown headings in form field order", () => {
    const human = buildMissionPromptHuman(baseOpts);
    expect(human.indexOf("## Instruction")).toBeLessThan(
      human.indexOf("## Goals"),
    );
    expect(human.indexOf("## Goals")).toBeLessThan(
      human.indexOf("## Additional context"),
    );
    expect(human.indexOf("## Repositories")).toBeLessThan(
      human.indexOf("## References"),
    );
    expect(human).not.toContain("<hermes_mission>");
    expect(human).not.toContain("<task>");
  });

  it("omits empty sections", () => {
    const human = buildMissionPromptHuman({ instruction: "Do it" });
    expect(human).toBe("## Instruction\n\nDo it");
  });
});
