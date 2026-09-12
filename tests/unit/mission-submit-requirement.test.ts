/** @jest-environment node */

// T-0065 — the disabled button that named the wrong blocker.
//
// Four disabling conditions, one explanation, and it was keyed off the one an
// operator could satisfy by doing nothing: Dispatch is open by default, so
// "Open Dispatch to choose how this mission runs" described a remedy already in
// place. With the name empty AND the ack outstanding, that is what it said.
// Once the ack cleared, `title` became undefined and the button was dead with no
// tooltip at all.
//
// Two independent QA passes reported "the disabled button reads as broken".
// Both were right and neither could say why, because the reason shown was never
// the reason that applied.

import {
  firstUnmetSubmitRequirement,
  DISPATCH_ACK_REQUIREMENT,
} from "@/lib/missions/mission-submit-requirement";

const ok = { name: "QA", instruction: "do it", dispatching: false, needsDispatchAck: false };

describe("the first unmet requirement is the one reported", () => {
  it("names the missing name when several are unmet", () => {
    // The exact case that misreported: empty name AND outstanding ack. It used
    // to say "open Dispatch"; Dispatch was already open.
    const b = firstUnmetSubmitRequirement({ ...ok, name: "", needsDispatchAck: true });
    expect(b?.code).toBe("name");
    expect(b?.message).toMatch(/name/i);
  });

  it("names the missing instruction once the name is filled", () => {
    expect(firstUnmetSubmitRequirement({ ...ok, instruction: "" })?.code).toBe("instruction");
  });

  it("names the acknowledgement when it is the sole blocker", () => {
    const b = firstUnmetSubmitRequirement({ ...ok, needsDispatchAck: true });
    expect(b?.code).toBe("ack");
    expect(b?.message).toBe(DISPATCH_ACK_REQUIREMENT);
  });

  it("reports nothing when every requirement is met", () => {
    expect(firstUnmetSubmitRequirement(ok)).toBeNull();
  });

  it("treats an all-whitespace name as missing", () => {
    expect(firstUnmetSubmitRequirement({ ...ok, name: "   " })?.code).toBe("name");
  });
});

describe("the reported reason and the disabled state cannot disagree", () => {
  // THE test in this file. Sixteen combinations, asserting that "a blocker
  // exists" agrees exactly with the button's own disabled expression. Without
  // it, "they cannot disagree" would be an intention rather than a fact.
  const bools = [false, true];

  it.each(
    bools.flatMap((n) =>
      bools.flatMap((i) =>
        bools.flatMap((d) => bools.map((a) => [n, i, d, a] as const)),
      ),
    ),
  )("name=%s instruction=%s dispatching=%s ack=%s", (hasName, hasInstruction, dispatching, needsAck) => {
    const input = {
      name: hasName ? "QA" : "",
      instruction: hasInstruction ? "do it" : "",
      dispatching,
      needsDispatchAck: needsAck,
    };
    // The button's disabled expression, transcribed.
    const disabled =
      !input.name.trim() || !input.instruction.trim() || dispatching || needsAck;

    expect(firstUnmetSubmitRequirement(input) !== null).toBe(disabled);
  });
});
