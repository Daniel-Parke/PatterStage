import {
  getScopeLabel,
  missionTimeToDevHours,
  buildGoalsSection,
  buildMissionPrompt,
  getMissionStatus,
  promptFromTemplate,
} from "@/lib/mission-helpers";
import type { CronJobData } from "@/lib/utils";

describe("getScopeLabel", () => {
  it("returns 'Quick Pass' for <= 10 min", () => {
    expect(getScopeLabel(5)).toBe("Quick Pass");
    expect(getScopeLabel(10)).toBe("Quick Pass");
  });

  it("returns 'Half Day' for 11-15 min", () => {
    expect(getScopeLabel(11)).toBe("Half Day");
    expect(getScopeLabel(14)).toBe("Half Day");
    expect(getScopeLabel(15)).toBe("Half Day");
  });

  it("returns 'Most of a Day' for 16-20 min", () => {
    expect(getScopeLabel(16)).toBe("Most of a Day");
    expect(getScopeLabel(18)).toBe("Most of a Day");
    expect(getScopeLabel(20)).toBe("Most of a Day");
  });

  it("returns 'Full Day' for 21-30 min", () => {
    expect(getScopeLabel(21)).toBe("Full Day");
    expect(getScopeLabel(25)).toBe("Full Day");
    expect(getScopeLabel(30)).toBe("Full Day");
  });

  it("returns 'Deep Dive' for 31-45 min", () => {
    expect(getScopeLabel(31)).toBe("Deep Dive");
    expect(getScopeLabel(40)).toBe("Deep Dive");
    expect(getScopeLabel(45)).toBe("Deep Dive");
  });

  it("returns 'Sprint' for > 45 min", () => {
    expect(getScopeLabel(46)).toBe("Sprint");
    expect(getScopeLabel(60)).toBe("Sprint");
    expect(getScopeLabel(120)).toBe("Sprint");
  });
});

describe("missionTimeToDevHours", () => {
  it("converts 15 min agent time to 4 dev hours", () => {
    expect(missionTimeToDevHours(15)).toBe(4);
  });

  it("converts 60 min agent time to 16 dev hours", () => {
    expect(missionTimeToDevHours(60)).toBe(16);
  });

  it("rounds to nearest integer", () => {
    expect(missionTimeToDevHours(10)).toBe(Math.round(10 * 16 / 60));
  });
});

describe("buildGoalsSection", () => {
  it("formats goals as numbered checklist", () => {
    const result = buildGoalsSection(["Fix bug", "Add tests"]);
    expect(result).toContain("1. [ ] Fix bug");
    expect(result).toContain("2. [ ] Add tests");
    expect(result).toContain("GOAL_DONE");
  });

  it("handles empty goals", () => {
    const result = buildGoalsSection([]);
    expect(result).toContain("## Goals");
  });
});

describe("buildMissionPrompt", () => {
  it("includes scope and safety sections", () => {
    const result = buildMissionPrompt({
      prompt: "Do the thing",
      goals: [],
      missionTimeMinutes: 15,
      timeoutMinutes: 10,
    });
    expect(result).toContain("MISSION SCOPE");
    expect(result).toContain("SAFETY LIMITS");
    expect(result).toContain("Do the thing");
  });

  it("includes goals section when goals present", () => {
    const result = buildMissionPrompt({
      prompt: "Do the thing",
      goals: ["Goal 1"],
      missionTimeMinutes: 15,
      timeoutMinutes: 10,
    });
    expect(result).toContain("## Goals");
    expect(result).toContain("1. [ ] Goal 1");
  });

  it("does not include goals section when empty", () => {
    const result = buildMissionPrompt({
      prompt: "Do the thing",
      goals: [],
      missionTimeMinutes: 15,
      timeoutMinutes: 10,
    });
    expect(result).not.toContain("1. [ ]");
  });

  it("can round-trip: injected sections are strippable", () => {
    // Simulate what handleEdit does: build a prompt, then strip injected sections
    const originalInstruction = "Review the codebase and fix bugs";
    const originalContext = "Focus on TypeScript strict mode issues";

    const promptWithGoals = buildMissionPrompt({
      prompt: originalInstruction + "\n\n---\n\n## Additional Context\n\n" + originalContext,
      goals: ["Find bugs", "Fix bugs"],
      missionTimeMinutes: 15,
      timeoutMinutes: 10,
    });

    // Strip injected sections (replicates handleEdit logic)
    let stripped = promptWithGoals;
    stripped = stripped.replace(/^## Goals \(complete each in order\)\n[\s\S]*?Mark each goal as done.*\n\n---\n\n/m, "");
    stripped = stripped.replace(/## MISSION SCOPE\n[\s\S]*?(?=\n## |\n\n---|\n\n[A-Z])/m, "\n");
    stripped = stripped.replace(/## SAFETY LIMITS\n[\s\S]*?(?=\n## |\n\n---|\n\n[A-Z])/m, "\n");

    // Verify injected sections are gone
    expect(stripped).not.toContain("## Goals (complete each in order)");
    expect(stripped).not.toContain("MISSION SCOPE");
    expect(stripped).not.toContain("SAFETY LIMITS");

    // Verify original content is preserved
    expect(stripped).toContain(originalInstruction);
    expect(stripped).toContain(originalContext);
  });
});

describe("getMissionStatus", () => {
  it("returns 'successful' when job deleted and was dispatched", () => {
    expect(getMissionStatus(null, "dispatched")).toEqual({ status: "successful" });
  });

  it("returns current status when job deleted and not dispatched", () => {
    expect(getMissionStatus(null, "queued")).toEqual({ status: "queued" });
  });

  it("returns 'failed' when job paused and disabled", () => {
    const job = { state: "paused", enabled: false } as CronJobData;
    const result = getMissionStatus(job, "dispatched");
    expect(result.status).toBe("failed");
    expect(result.error).toContain("Cancelled");
  });

  it("returns 'dispatched' when job is running", () => {
    const job = { state: "running", enabled: true, last_status: "ok" } as CronJobData;
    expect(getMissionStatus(job, "dispatched")).toEqual({ status: "dispatched" });
  });

  it("returns 'queued' when job never ran", () => {
    const job = { state: "scheduled", enabled: true, last_run_at: null } as CronJobData;
    expect(getMissionStatus(job, "queued")).toEqual({ status: "queued" });
  });

  it("returns 'successful' when last_status is ok", () => {
    const job = { state: "scheduled", enabled: true, last_run_at: "2026-01-01", last_status: "ok" } as CronJobData;
    expect(getMissionStatus(job, "dispatched")).toEqual({ status: "successful" });
  });

  it("returns 'failed' when last_status is error", () => {
    const job = { state: "scheduled", enabled: true, last_run_at: "2026-01-01", last_status: "error" } as CronJobData;
    expect(getMissionStatus(job, "dispatched")).toEqual({ status: "failed" });
  });

  it("returns 'dispatched' when ran but no status yet", () => {
    const job = { state: "scheduled", enabled: true, last_run_at: "2026-01-01", last_status: null } as CronJobData;
    expect(getMissionStatus(job, "dispatched")).toEqual({ status: "dispatched" });
  });
});

describe("promptFromTemplate", () => {
  it("combines instruction and context", () => {
    const result = promptFromTemplate({
      id: "test", name: "Test", icon: "", color: "", category: "",
      profile: "", description: "", instruction: "Do X",
      context: "Details here", goals: [], suggestedSkills: [],
    });
    expect(result).toContain("Do X");
    expect(result).toContain("## Additional Context");
    expect(result).toContain("Details here");
  });

  it("omits context section when empty", () => {
    const result = promptFromTemplate({
      id: "test", name: "Test", icon: "", color: "", category: "",
      profile: "", description: "", instruction: "Do X",
      context: "", goals: [], suggestedSkills: [],
    });
    expect(result).toBe("Do X");
  });
});
