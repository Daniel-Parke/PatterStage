// ═══════════════════════════════════════════════════════════════
// mission-name.ts — every mission gets a name that means something
//
// `name: (name as string)?.trim() || "Untitled Mission"` was one inline literal
// in the dispatch handler, and it made every unnamed mission identical on the
// board: create three and you get three rows you cannot tell apart, with no
// hint of what any of them does (T-0079).
//
// Story Weaver already solved exactly this — `story-weaver/create` titles a
// story from the first few words of its premise, specifically so "the library
// doesn't fill with indistinguishable rows". This follows that precedent rather
// than inventing a second constant.
//
// The constant survives for the case where there is genuinely nothing to derive
// from: no name AND no instruction. That is a mission with no content at all,
// and naming it after its emptiness is honest.
// ═══════════════════════════════════════════════════════════════

/** Longest name the board renders on one line. */
const MAX_NAME = 80;
const FALLBACK = "Untitled Mission";

/**
 * The name to store for a mission.
 *
 * @param supplied what the caller sent, if anything
 * @param instruction the mission's own text, used when no name was given
 */
/**
 * A supplied name, collapsed and capped, or null when there is none.
 * The update/promote path used to bypass this (T-0088): `input.name.trim()`
 * let newlines and a thousand characters straight onto every board card.
 */
export function normaliseMissionName(supplied: unknown): string | null {
  const given = typeof supplied === "string" ? supplied.replace(/\s+/g, " ").trim() : "";
  if (!given) return null;
  return given.length > MAX_NAME ? `${given.slice(0, MAX_NAME - 1).trimEnd()}…` : given;
}

export function missionNameFrom(supplied: unknown, instruction: unknown): string {
  const given = normaliseMissionName(supplied);
  if (given) return given;

  const body = typeof instruction === "string" ? instruction.replace(/\s+/g, " ").trim() : "";
  if (!body) return FALLBACK;

  // First clause or first dozen words, whichever comes sooner — enough to tell
  // two missions apart at a glance without turning the board into prose.
  const firstClause = body.split(/[.!?\n]/)[0]?.trim() || body;
  const words = firstClause.split(" ").slice(0, 12).join(" ");
  const name = words.length > MAX_NAME ? `${words.slice(0, MAX_NAME - 1).trimEnd()}…` : words;
  return name || FALLBACK;
}
