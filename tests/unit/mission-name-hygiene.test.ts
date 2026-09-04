/** @jest-environment node */

// T-0088: round 6, finding 16. Dispatch already collapses whitespace and caps
// a mission name at 80 (T-0079's missionNameFrom). The update/promote path
// bypassed both: `updates.name = input.name.trim() || existing.name`, so a
// name with embedded newlines or a thousand characters went straight to the
// row and every board card that renders it.

jest.mock("@/lib/models-repository", () => ({ findModelByModelId: () => null }));
jest.mock("@/lib/db", () => ({ getDb: jest.fn(), ensureDb: jest.fn(), now: () => "t", uuid: () => "u", inTransaction: <T,>(fn: () => T) => fn() }));

import type { Mission } from "@/lib/missions/mission-types";
import { normaliseMissionName, missionNameFrom } from "@/lib/missions/mission-name";
import { buildMissionFieldPatch } from "@/lib/missions/mission-field-updates";

const existing = {
  id: "m_1",
  name: "Old name",
  prompt: "Do the thing",
  status: "draft",
  localDirs: [],
  references: [],
  skills: [],
  suggestedToolsets: [],
  goals: [],
} as unknown as Mission;

describe("normaliseMissionName", () => {
  it("collapses whitespace, including newlines, to single spaces", () => {
    expect(normaliseMissionName("  Fix\n\nthe   build\t now ")).toBe("Fix the build now");
  });

  it("caps at 80 characters with an ellipsis, like dispatch does", () => {
    const long = "x".repeat(200);
    const out = normaliseMissionName(long)!;
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.endsWith("…")).toBe(true);
  });

  it("is null for blank or non-string input", () => {
    expect(normaliseMissionName("   ")).toBeNull();
    expect(normaliseMissionName(undefined)).toBeNull();
    expect(normaliseMissionName(42)).toBeNull();
  });

  it("is what missionNameFrom uses for a supplied name", () => {
    expect(missionNameFrom("  a \n b  ", "ignored")).toBe(normaliseMissionName("  a \n b  "));
  });
});

describe("the update path applies the same hygiene", () => {
  it("collapses and caps a renamed mission", () => {
    const r = buildMissionFieldPatch(existing, { name: "New\n\n  name " + "y".repeat(100) }, undefined);

    expect(r.updates.name).toMatch(/^New name y+…$/);
    expect(r.updates.name!.length).toBeLessThanOrEqual(80);
  });

  it("keeps the existing name when the new one is blank", () => {
    const r = buildMissionFieldPatch(existing, { name: "  \n " }, undefined);

    expect(r.updates.name).toBe("Old name");
  });
});
