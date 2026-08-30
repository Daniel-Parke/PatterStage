// ═══════════════════════════════════════════════════════════════
// mission-submit-requirement.ts — one reason, in the order it applies
//
// The composer's submit button had FOUR disabling conditions and ONE
// explanation. `title` was keyed exclusively off the dispatch acknowledgement,
// so an operator with an empty Mission Name and an outstanding ack was told to
// open Dispatch, which is the one thing they could fix by doing nothing (it is
// open by default). And once the ack cleared, `title` became undefined: the
// button was still dead, now with no tooltip at all. The remedy text vanished at
// exactly the moment a remaining blocker became the sole cause.
//
// Two passes reported this as "the disabled button reads as broken". Both were
// right, and neither could see why, because the reason shown was never the
// reason that applied.
//
// Pure, and in src/lib/ rather than beside the component, so the ORDER and the
// WORDING can be unit-tested in a node environment without rendering anything.
// The same argument scheduler-pill.ts's header makes for itself.
// ═══════════════════════════════════════════════════════════════

export const DISPATCH_ACK_REQUIREMENT =
  "Open Dispatch to choose how this mission runs before submitting.";

export interface SubmitBlocker {
  code: "name" | "instruction" | "dispatching" | "ack";
  message: string;
}

/**
 * The FIRST unmet requirement, in the same order as the button's disabled
 * expression, or null when there is none.
 *
 * The ordering is the contract: a test iterates all sixteen boolean
 * combinations and asserts `blocker !== null` agrees with the disabled
 * expression exactly. That is what makes "the tooltip and the disabled state
 * cannot disagree" a fact rather than an intention, since there is no longer a
 * second place for them to disagree in.
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
    // Deliberately carries a message even though the UI shows none: a spinner
    // already says this, and a tooltip repeating it is noise. The code is here
    // so the caller can decide, rather than this module deciding for it.
    return { code: "dispatching", message: "Submitting..." };
  }
  if (input.needsDispatchAck) {
    return { code: "ack", message: DISPATCH_ACK_REQUIREMENT };
  }
  return null;
}
