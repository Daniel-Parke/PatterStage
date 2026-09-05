// ═══════════════════════════════════════════════════════════════
// story-status-labels — a story's word, from the one vocabulary
//
// Lives in the module because the story status union is the module's
// (story-repository.ts) and core may not import a module (ADR-0005); the
// vocabulary itself is core's (src/lib/status-labels.ts), which a module may
// import. `active` reads "Waiting for you" because that is what it is: a
// story with chapters left that will not write another until asked (B14).
// ═══════════════════════════════════════════════════════════════

import type { StatusLabel } from "@/lib/status-labels";

export type StoryStatus = "generating" | "active" | "complete" | "failed";

export const STORY_STATUS_LABELS = {
  generating: "Running",
  active: "Waiting for you",
  complete: "Completed",
  failed: "Failed",
} as const satisfies Record<StoryStatus, StatusLabel>;

/** A story summary's status may be absent on older rows; that is a story waiting for the operator. */
export function storyStatusLabel(status: string | undefined | null): StatusLabel {
  return STORY_STATUS_LABELS[status as StoryStatus] ?? "Waiting for you";
}
