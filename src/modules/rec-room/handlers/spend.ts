// ═══════════════════════════════════════════════════════════════
// story-handlers/spend.ts — POST action "spend": what this story has cost.
//
// Story generation calls a paid model. The spend was recorded from the first
// chapter and totalled in the console, and the Rec Room never mentioned it, so
// the first a person heard of a story's cost was their provider bill.
//
// This is the read the reader draws. It computes nothing of its own: the
// arithmetic is `recordedSpendForStory`, which is the same fold the console's
// Story Weaver row goes through, because two money figures that disagree is a
// defect this programme has already fixed once (T-0108, D104).
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api/api-logger";
import { recordedSpendForStory } from "@/lib/spend/spend-window";
import { getStory } from "@/modules/rec-room/lib/story-repository";

export async function handleStorySpend(body: Record<string, unknown>): Promise<NextResponse> {
  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "Missing storyId" }, { status: 400 });

  // A story that is not there is a 404, not a $0.00. A confident zero for a
  // story nobody can find would read as "this was free" rather than "this was
  // never asked about", and free is the one thing spend must never say by
  // accident.
  if (!getStory(storyId as string)) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  try {
    return NextResponse.json({ data: { spend: recordedSpendForStory(storyId as string) } });
  } catch (err) {
    // The read throws so the caller can choose, and the choice here is to say
    // the figure is unavailable. The reader hides the line rather than drawing
    // a number nothing measured.
    return serverErrorFromCatch(
      "POST /api/stories",
      "reading what this story has cost",
      err,
      "Could not work out what this story has cost. The story itself is unaffected; try again, or open Insights for the full spend.",
    );
  }
}
