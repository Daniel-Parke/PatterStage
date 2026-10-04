/** @jest-environment jsdom */

// T0194 independent Faraday oracle, 2026-10-04. Q027 changes guidance, not timers.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import AgentRuntimeDefaultsCard from "@/components/missions/AgentRuntimeDefaultsCard";
import { buildMissionPrompt, buildMissionPromptHuman } from "@/lib/missions/build-mission-prompt";
import { buildMissionRunView, declaredTimeoutMinutes } from "@/lib/orchestration/run-deadline";
import type { RunRecord } from "@/lib/runs/runs-repository";

jest.mock("@/components/ui/ProfilePicker", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/missions/ModelPicker", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/missions/SkillsPicker", () => ({ __esModule: true, default: () => null }));

const formats = [
  { format: "AI XML", build: buildMissionPrompt },
  { format: "human Markdown", build: buildMissionPromptHuman },
];
const compact = (text: string) => text.replace(/\s+/g, " ");
const sinceSubmission = /(?:elapsed.{0,100}submi(?:ssion|tted)|submi(?:ssion|tted).{0,100}elapsed)/i;
const grace = /(?:5|five)[ -]minute.{0,60}(?:grace|reconcil)|(?:grace|reconcil).{0,60}(?:5|five)[ -]minute/i;
const noToolRenewal = /tool.{0,80}(?:not|never).{0,50}(?:renew|reset|extend)|(?:not|never).{0,50}(?:renew|reset|extend).{0,80}tool/i;

describe("T0194 Q027 elapsed deadline guidance", () => {
  it.each(formats)("$format positive timeout wins over scope and describes elapsed submission plus grace", ({ build }) => {
    const prompt = compact(build({ instruction: "Synthetic deadline", timeoutMinutes: 30, missionTimeMinutes: 90 }));
    expect(prompt).toMatch(/Elapsed run deadline: 30 minutes/i);
    expect(prompt).not.toMatch(/Elapsed run deadline: 90 minutes/i);
    expect(prompt).toMatch(sinceSubmission);
    expect(prompt).toMatch(grace);
    expect(prompt).toMatch(noToolRenewal);
    expect(prompt).not.toMatch(/inactivity/i);
  });

  it.each(formats)("$format absent timeout uses the planning horizon as the declared elapsed fallback", ({ build }) => {
    const prompt = compact(build({ instruction: "Synthetic scope fallback", missionTimeMinutes: 90 }));
    expect(prompt).toMatch(/Elapsed run deadline: 90 minutes/i);
    expect(prompt).toMatch(/planning (?:horizon|hint|estimate)/i);
    expect(prompt).toMatch(sinceSubmission);
    expect(prompt).toMatch(grace);
  });

  it.each(formats)("$format explicit zero keeps planning scope without declaring its elapsed fallback", ({ build }) => {
    const prompt = compact(build({ instruction: "Synthetic explicit zero", timeoutMinutes: 0, missionTimeMinutes: 90 }));
    expect(declaredTimeoutMinutes({ timeoutMinutes: 0, missionTimeMinutes: 90 })).toBeNull();
    expect(prompt).not.toMatch(/Elapsed run deadline: (?:0|90) minutes/i);
    expect(prompt).toMatch(/planning (?:horizon|hint|estimate)/i);
    expect(prompt).not.toMatch(/inactivity/i);
  });

  it.each(["card", "embedded"] as const)("Runtime %s keeps real timeout selection and explains explicit-zero ownership", variant => {
    const changed = jest.fn();
    function Runtime() {
      const [timeout, setTimeoutValue] = useState(30);
      return <AgentRuntimeDefaultsCard variant={variant} profileId="" onProfileChange={() => {}}
        missionTimeMinutes={90} onMissionTimeChange={() => {}} timeoutMinutes={timeout}
        onTimeoutChange={value => { changed(value); setTimeoutValue(value); }}
        timeoutHeading="Timeout" modelId="" provider="" onModelChange={() => {}} />;
    }
    const { container } = render(<Runtime />);
    fireEvent.click(screen.getByRole("button", { name: /^Timeout/ }));
    fireEvent.click(screen.getByRole("option", { name: /∞|unlimited|no.*deadline/i }));
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith(0);
    const text = compact(container.textContent || "");
    expect(text).toMatch(/elapsed/i);
    expect(text).toMatch(/submi(?:ssion|tted)/i);
    expect(text).toMatch(grace);
    expect(text).toMatch(/(?:zero|0).{0,100}(?:no|disable|suppress).{0,100}(?:deadline|scope|fallback)/i);
    expect(text).not.toMatch(/inactivity/i);
  });

  it("CONTROL current deadline remains submission plus five minutes of grace despite later tool activity", () => {
    const submittedAt = "2026-10-04T12:00:00.000Z";
    const run: RunRecord = { id: "oracle-run", runId: "oracle-backend", missionId: "oracle-mission",
      scheduleId: null, composerNodeRunId: null, profileName: null, sessionId: null, status: "started",
      output: "Recent tool activity", usage: null, error: null, submittedAt, completedAt: null,
      updatedAt: "2026-10-04T12:34:59.000Z" };
    const mission = { timeoutMinutes: 30, missionTimeMinutes: 90 };
    expect(buildMissionRunView(mission, run)).toMatchObject({ deadlineAt: "2026-10-04T12:35:00.000Z", deadlineDeclared: true });
    expect(buildMissionRunView(mission, { ...run, updatedAt: "2026-10-04T13:00:00.000Z" }))
      .toMatchObject({ deadlineAt: "2026-10-04T12:35:00.000Z", deadlineDeclared: true });
  });

  it("Mission guide explains elapsed timing and limits undeclared safety caps to unreachable backends", () => {
    const guide = compact(readFileSync(resolve("docs/guides/missions.md"), "utf8"));
    expect(guide).not.toMatch(/inactivity kill switch/i);
    expect(guide).toMatch(sinceSubmission);
    expect(guide).toMatch(grace);
    expect(guide).toMatch(noToolRenewal);
    expect(guide).toMatch(/(?:undeclared|no declared|no timeout).{0,200}safety cap|safety cap.{0,200}(?:undeclared|no declared|no timeout)/i);
    expect(guide).toMatch(/(?:only|solely).{0,100}(?:unreachable|cannot reach)|(?:unreachable|cannot reach).{0,100}(?:only|solely)/i);
  });
});
