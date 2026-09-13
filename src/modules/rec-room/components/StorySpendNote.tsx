// StorySpendNote — what this story has cost, said quietly, in the reader.
//
// Story generation calls a paid model, recorded since T-0108 and totalled in
// the spend console, and the Rec Room never mentioned it. Two rules pull
// against each other: IT IS ALWAYS THERE, including at zero, because a
// disclosure that appears after money is spent arrives after the surprise; and
// IT IS NEVER A SCARE, one line of small text, no modal, nothing to dismiss.
// The figure is `recordedSpendForStory`, the console's own fold, so this line
// and the Story Weaver row are one number. Never compute a second one here.

"use client";

import { formatUsd } from "@/lib/spend/spend-law";
import type { SpendWindowSource } from "@/lib/spend/spend-window";

/**
 * The create page's sentence, so both say it the same way. It must NOT say
 * "published per-model rates": a story run records no model, so every story
 * figure is the fallback rate, and the console had the same claim removed.
 */
const HOW_ESTIMATED =
  "Estimated from the token usage recorded for this story. Chapters record no model to price against, so this uses a fallback rate: treat it as a rough guide, not an invoice. Insights shows every source together.";

export interface StorySpendNoteProps {
  /** The story's recorded spend, or null while it is unknown. */
  spend: SpendWindowSource | null;
}

export default function StorySpendNote({ spend }: StorySpendNoteProps) {
  // Unknown is not zero, so a figure that could not be read says nothing at
  // all rather than drawing a confident $0.00 the console would contradict.
  if (!spend || !spend.recorded) return null;

  const calls = spend.runs;
  const text =
    calls === 0
      ? "Writing a chapter calls a paid model. Nothing spent on this story yet."
      : `This story so far: ${formatUsd(spend.costUsd ?? 0)} (${calls} model call${calls === 1 ? "" : "s"})`;

  return (
    <span
      data-testid="story-spend-note"
      title={HOW_ESTIMATED}
      className="text-body leading-none text-ps-text-faint"
    >
      {text}
    </span>
  );
}
