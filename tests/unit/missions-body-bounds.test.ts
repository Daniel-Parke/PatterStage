/** @jest-environment node */

// T-0088: the mission body is guarded at its one choke point. Round 6,
// finding 12: timeoutMinutes was a bare cast. Sharper than reported: 1e9
// REPLACED the 120-minute safety cap, so a mission whose backend vanished
// never self-healed and wedged the single-flight gate forever; "60" as a
// string put a limit in the prompt the reconciler did not enforce. And the
// four list fields crashed formatList when a string arrived.

jest.mock("@/lib/models-repository", () => ({
  findModelByModelId: jest.fn(() => null),
}));

import { parseMissionBodyFields } from "@/lib/missions/mission-body";
import {
  MAX_TIMEOUT_MINUTES,
  MIN_TIMEOUT_MINUTES,
  missionTimeoutError,
  parseTimeoutMinutes,
} from "@/lib/missions/mission-timeout";

describe("timeouts are positive integers inside the ceiling", () => {
  it("publishes the ceiling: three days", () => {
    expect(MIN_TIMEOUT_MINUTES).toBe(1);
    expect(MAX_TIMEOUT_MINUTES).toBe(4320);
  });

  it.each([
    [60, 60],
    [1, 1],
    [4320, 4320],
    [undefined, undefined],
    [null, undefined],
  ])("parseTimeoutMinutes(%p) -> %p", (input, expected) => {
    expect(parseTimeoutMinutes(input)).toBe(expected);
  });

  it.each([1e9, 4321, 0, -5, 60.5, "60", "", NaN, Infinity, {}, []])(
    "parseTimeoutMinutes(%p) is refused, never stored",
    (input) => {
      expect(parseTimeoutMinutes(input)).toBe("invalid");
    },
  );

  it("missionTimeoutError names the field, the value and the range", () => {
    const err = missionTimeoutError({ timeoutMinutes: 1e9 });
    expect(err).toMatch(/timeoutMinutes/);
    expect(err).toMatch(/1000000000/);
    expect(err).toMatch(/1.*4320/);
  });

  it("missionTimeoutError covers missionTimeMinutes too, and is null when both are fine or absent", () => {
    expect(missionTimeoutError({ missionTimeMinutes: "60" })).toMatch(/missionTimeMinutes/);
    expect(missionTimeoutError({ timeoutMinutes: 30, missionTimeMinutes: 90 })).toBeNull();
    expect(missionTimeoutError({})).toBeNull();
  });

  it("parseMissionBodyFields never carries an invalid timeout through", () => {
    const f = parseMissionBodyFields({ timeoutMinutes: 1e9, missionTimeMinutes: "60" });
    expect(f.timeoutMinutes).toBeUndefined();
    expect(f.missionTimeMinutes).toBeUndefined();
    expect(parseMissionBodyFields({ timeoutMinutes: 45 }).timeoutMinutes).toBe(45);
  });
});

describe("the list fields are lists of non-empty strings, or nothing", () => {
  it("a bare string becomes a one-item list", () => {
    const f = parseMissionBodyFields({ references: "docs/spec.md" });
    expect(f.references).toEqual(["docs/spec.md"]);
  });

  it("junk entries are dropped and strings trimmed", () => {
    const f = parseMissionBodyFields({ skills: [" a ", 1, null, "", "b"] });
    expect(f.skills).toEqual(["a", "b"]);
  });

  it("an object is not a list", () => {
    const f = parseMissionBodyFields({ goals: { not: "a list" }, suggestedToolsets: 42 });
    expect(f.goals).toBeUndefined();
    expect(f.suggestedToolsets).toBeUndefined();
  });

  it("GREEN CONTROL: a proper list passes unchanged", () => {
    const f = parseMissionBodyFields({ goals: ["one", "two"] });
    expect(f.goals).toEqual(["one", "two"]);
  });
});
