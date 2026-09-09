// mission-submit-requirement.ts — one reason, in the order it applies. The
// composer's submit button had FOUR disabling conditions and ONE explanation,
// keyed off the dispatch acknowledgement alone: an empty Mission Name with an
// outstanding ack was told to open Dispatch (open by default), and once the ack
// cleared the button stayed dead with no tooltip at all. Two passes reported
// "the disabled button reads as broken"; the reason shown was never the reason
// that applied. Pure and in src/lib/ so ORDER and WORDING are unit-testable
// without rendering, the argument scheduler-pill.ts's header makes for itself.

export const DISPATCH_ACK_REQUIREMENT =
  "Open Dispatch to choose how this mission runs before submitting.";

export interface SubmitBlocker {
  code: "name" | "instruction" | "dispatching" | "ack";
  message: string;
}

/**
 * The FIRST unmet requirement, in the button's disabled-expression order, or
 * null. The ordering is the contract: a test iterates all sixteen combinations
 * and asserts `blocker !== null` agrees with the disabled expression, so the
 * tooltip and the disabled state have no second place to disagree in.
 */
export function firstUnmetSubmitRequirement(input: {
  name: string;
  instruction: string;
  dispatching: boolean;
  needsDispatchAck: boolean;
}): SubmitBlocker | null {
  if (!input.name.trim()) {
    return { code: "name", message: "Enter a Mission Name before submitting." };
  }
  if (!input.instruction.trim()) {
    return { code: "instruction", message: "Enter an instruction before submitting." };
  }
  if (input.dispatching) {
    // Carries a message the UI does not show (a spinner already says it), so
    // the caller decides rather than this module.
    return { code: "dispatching", message: "Submitting..." };
  }
  if (input.needsDispatchAck) {
    return { code: "ack", message: DISPATCH_ACK_REQUIREMENT };
  }
  return null;
}
