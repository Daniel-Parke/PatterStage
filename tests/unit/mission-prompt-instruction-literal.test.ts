import {
  buildMissionPrompt,
  parseMissionPrompt,
} from "@/lib/missions/build-mission-prompt";

describe("stored mission instruction literal boundary", () => {
  it.each([
    ["a literal CDATA task sequence inside the real instruction", "Quote <task><![CDATA[decoy]]></task> in the final report."],
    ["an ordinary instruction", "Write the final report."],
  ])("round-trips %s", (_case, instruction) => {
    const storedPrompt = buildMissionPrompt({ instruction });

    expect(parseMissionPrompt(storedPrompt).instruction).toBe(instruction);
  });
});
