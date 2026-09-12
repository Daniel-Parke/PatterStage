// ═══════════════════════════════════════════════════════════════
// story-handlers/shared.ts — pure helpers shared by the story actions
//
// Extracted from src/app/api/stories/route.ts (no logic change): StoryArc
// shape-normalisation, LLM-output scrubbing, prompt builders, and the
// length→chapter-count map.
// ═══════════════════════════════════════════════════════════════

import type { StoryArc as StoryArcType, ChapterOutline } from "@/modules/rec-room/types";

import { normaliseStoryCharacters } from "../lib/characters";
/** A mood is a list of words. A word is a one-item list; anything else is none. */
/** How this call is billed, and how it is stopped. Threaded from the route. */
export interface StoryCallOptions {
  signal?: AbortSignal;
}

export function normaliseMood(mood: unknown): string[] {
  if (typeof mood === "string") return mood.trim() ? [mood.trim()] : [];
  if (Array.isArray(mood)) return mood.filter((m): m is string => typeof m === "string" && m.trim().length > 0);
  return [];
}

const stringList = (v: unknown): string[] =>
  typeof v === "string" ? (v.trim() ? [v] : []) : Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const objectList = <T,>(v: unknown): T[] =>
  Array.isArray(v) ? (v.filter((x) => x !== null && typeof x === "object") as T[]) : [];

/**
 * Guarantee the shape the chapter prompt reads. An LLM wrote this JSON, and
 * generate-chapter did `outline.keyBeats.join` on it (T-0087).
 */
function normaliseArc(a: Record<string, unknown>): StoryArcType {
  const outlines = objectList<Record<string, unknown>>(a.chapterOutlines).map((o, i) => ({
    ...o,
    number: typeof o.number === "number" ? o.number : i + 1,
    title: typeof o.title === "string" ? o.title : `Chapter ${i + 1}`,
    purpose: typeof o.purpose === "string" ? o.purpose : "",
    emotionalTone: typeof o.emotionalTone === "string" ? o.emotionalTone : "",
    keyBeats: stringList(o.keyBeats),
  })) as unknown as ChapterOutline[];
  // Coerce what is PRESENT and wrong; leave absent keys absent. The prompt
  // reads the optional lists with ?. and the required ones are guaranteed.
  const out: Record<string, unknown> = {
    ...a,
    storyArc: typeof a.storyArc === "string" ? a.storyArc : "",
    fixedPlotPoints: objectList(a.fixedPlotPoints),
    chapterOutlines: outlines,
  };
  if ("characterArcs" in a) out.characterArcs = objectList(a.characterArcs);
  if ("worldRules" in a) out.worldRules = stringList(a.worldRules);
  if ("themes" in a) out.themes = stringList(a.themes);
  return out as unknown as StoryArcType;
}

export function safeArc(arc: unknown): StoryArcType | undefined {
  // Handle JSON string stored in DB (common for SQLite JSON columns)
  if (typeof arc === "string") {
    try { arc = JSON.parse(arc); } catch { return undefined; }
  }
  if (!arc || typeof arc !== "object") return undefined;
  const a = arc as Record<string, unknown>;

  // CASE 1: Nested wrapper — outer object has a storyArc property that is the real StoryArc.
  // storyArc.storyArc is a string, storyArc.fixedPlotPoints is an array.
  // The top-level has the same array properties but as empty arrays (from spread merge).
  if (
    typeof a.storyArc === "object" && a.storyArc !== null &&
    !Array.isArray(a.fixedPlotPoints) && !Array.isArray(a.chapterOutlines)
  ) {
    const inner = a.storyArc as Record<string, unknown>;
    if (
      typeof inner.storyArc === "string" &&
      Array.isArray(inner.fixedPlotPoints) &&
      Array.isArray(inner.chapterOutlines)
    ) {
      return normaliseArc(inner);
    }
  }

  // CASE 2: Normal (flat) StoryArc — storyArc is a string at top level
  if (
    typeof a.storyArc === "string" &&
    Array.isArray(a.fixedPlotPoints) &&
    Array.isArray(a.chapterOutlines)
  ) {
    return normaliseArc(a);
  }

  return undefined;
}

export function validateChapterOutput(raw: string): string {
  let content = raw.trim();
  const metaPrefixes = [
    /^here('s| is) (?:your |the )?(?:chapter|prose|story)/i,
    /^(?:sure|certainly|of course|okay|alright)[.!]?\s*/i,
    /^i'll (?:now |go ahead and )?write/i,
    /^let me (?:write|craft|create)/i,
    /^chapter \d+[.:]\s*/i,
  ];
  for (const prefix of metaPrefixes) { content = content.replace(prefix, ""); }

  const metaSuffixes = [
    /\s*(?:i hope|let me know|i trust|this should|feel free)[^.!?]*[.!?\s]*$/i,
    /\s*---+\s*(?:end of chapter|chapter \d+ ends?)[^.]*$/i,
  ];
  for (const suffix of metaSuffixes) { content = content.replace(suffix, ""); }

  content = content.replace(/===CHAPTER \d+===/gi, "");
  content = content.replace(/===ARC===/gi, "");
  content = content.replace(/===PLAN===/gi, "");
  return content.trim();
}

/**
 * The chapter-length bands the create form offers.
 *
 * Read through `wordRange` below, which is what the edit and continue handlers
 * call: the table was inline in buildMasterPrompt, so those two ignored what the
 * operator picked (T-0108, D90/D91).
 */
const WORD_RANGES: Record<string, string> = {
  short: "800-1200",
  medium: "1200-1800",
  standard: "1800-2500",
  long: "2500-3500",
  epic: "3500-5000",
  marathon: "5000+",
};

/** The band for an id, or the standard one. */
export function wordRange(id: unknown): string {
  return WORD_RANGES[(id as string) || "standard"] ?? "1800-2500";
}

/** The writing model the operator chose, or undefined = the agent default. */
export function storyModelId(story: { config?: Record<string, unknown> }): string | undefined {
  const v = story.config?.modelId;
  return typeof v === "string" && v.trim() ? v : undefined;
}

export function buildMasterPrompt(config: Record<string, unknown>): string {
  const wcRange = wordRange(config.wordCountRange);

  // Normalised, not cast. A caller writing `characters: ["QA-Bot"]` -- which
  // reads as perfectly reasonable, and which nothing validates -- used to reach
  // the model as "- undefined (undefined): undefined" (T-0079).
  const characters = normaliseStoryCharacters(config.characters);
  const charProfiles = characters.map(c => {
    const parts = [`- ${c.name} (${c.role}): ${c.description}`];
    if (c.personality) parts.push(`  Personality: ${c.personality}`);
    if (c.appearance) parts.push(`  Appearance: ${c.appearance}`);
    if (c.backstory) parts.push(`  Backstory: ${c.backstory}`);
    if (c.speechPatterns) parts.push(`  Speech Patterns: ${c.speechPatterns}`);
    if (c.relationships) parts.push(`  Relationships: ${c.relationships}`);
    return parts.join("\n");
  }).join("\n\n");

  return [
    `STORY CONFIGURATION:`,
    `Title: ${(config.title as string) || "Untitled"}`,
    `Premise: ${config.premise as string}`,
    `Genre: ${(config.genre as string) || "General"}`,
    `Era: ${(config.era as string) || "Modern"}`,
    `Setting: ${(config.setting as string) || ""}`,
    `Mood: ${((config.mood as string[]) || []).join(", ")}`,
    `POV: ${(config.pov as string) || "first"}`,
    `Length: ${(config.length as string) || "medium"}`,
    `Chapter Length: ${wcRange} words per chapter`,
    ``,
    `CHARACTERS:`,
    charProfiles || "(none specified)",
  ].join("\n");
}

/**
 * Render an arc view focused on ONE chapter, instead of dumping the whole arc
 * JSON. Surfaces: the throughline + themes/world-rules; the fixed plot points
 * that MUST occur in this chapter (filtered by `fixedPlotPoint.chapter`); the
 * next 1-2 upcoming points to foreshadow (not resolve); and each character's
 * arc with a "how far through" hint derived from chapter N of the total. This
 * is what conditions the model on where the story should be right now.
 */
export function focusArcForChapter(
  arc: StoryArcType,
  chapterNumber: number,
  totalChapters: number,
): string {
  const parts: string[] = [];
  parts.push("Throughline: " + (arc.storyArc || "(unspecified)"));
  if (arc.themes?.length) parts.push("Themes: " + arc.themes.join(", "));
  if (arc.worldRules?.length) parts.push("World Rules: " + arc.worldRules.join("; "));

  const points = Array.isArray(arc.fixedPlotPoints) ? arc.fixedPlotPoints : [];
  const thisChapter = points.filter((p) => p.chapter === chapterNumber);
  parts.push("");
  parts.push("FIXED PLOT POINTS THAT MUST OCCUR IN THIS CHAPTER:");
  if (thisChapter.length) {
    for (const p of thisChapter) {
      parts.push(`- ${p.event}${p.setup ? ` (setup: ${p.setup})` : ""}`);
    }
  } else {
    parts.push("- (none mandated — advance the throughline toward the next fixed point)");
  }

  const upcoming = points
    .filter((p) => p.chapter > chapterNumber)
    .sort((a, b) => a.chapter - b.chapter)
    .slice(0, 2);
  if (upcoming.length) {
    parts.push("");
    parts.push("UPCOMING (foreshadow only — do NOT resolve these yet):");
    for (const p of upcoming) parts.push(`- [Ch ${p.chapter}] ${p.event}`);
  }

  if (arc.characterArcs?.length) {
    const pct = totalChapters > 0 ? Math.round((chapterNumber / totalChapters) * 100) : 0;
    parts.push("");
    parts.push(`CHARACTER ARCS (by chapter ${chapterNumber} of ${totalChapters}, ~${pct}% through):`);
    for (const c of arc.characterArcs) {
      parts.push(`- ${c.name}: ${c.journey} (start: ${c.startingState} → end: ${c.endingState})`);
    }
  }
  return parts.join("\n");
}

export function buildChapterPrompt(
  masterPrompt: string,
  storyArc: StoryArcType,
  rollingSummary: string | null,
  recentChapters: { number: number; content: string }[],
  outline: ChapterOutline,
  totalChapters: number,
): string {
  const parts: string[] = [];
  parts.push("===MASTER PROMPT===\n" + masterPrompt);
  parts.push(
    "\n===STORY ARC (focused for this chapter)===\n" +
      focusArcForChapter(storyArc, outline.number, totalChapters),
  );
  if (rollingSummary) { parts.push("\n===NARRATIVE SO FAR===\n" + rollingSummary); }
  if (recentChapters.length) {
    parts.push("\n===RECENT CHAPTERS (match the established voice, tense, and facts)===");
    for (const ch of recentChapters) {
      parts.push(`--- Chapter ${ch.number} ---\n${ch.content}`);
    }
  }
  parts.push("\n===CHAPTER OUTLINE===\n" +
    `Title: ${outline.title}\nPurpose: ${outline.purpose}\n` +
    `Key Beats: ${outline.keyBeats.join("; ")}\nEmotional Tone: ${outline.emotionalTone}` +
    (outline.setupForNext ? `\nSetup for Next: ${outline.setupForNext}` : ""),
  );
  parts.push(
    "\n===CHECKLIST (verify before you finish)===\n" +
      "- Address every Key Beat listed above.\n" +
      "- Make every fixed plot point for THIS chapter actually happen on the page.\n" +
      "- Keep continuity with the recent chapters (names, tense, established facts).\n" +
      "- Do not resolve upcoming plot points early.\n" +
      `\nWrite Chapter ${outline.number} now. Return ONLY prose.`,
  );
  return parts.join("\n");
}

export function getChapterCount(length: string): number {
  switch (length) {
    case "short": return 3;
    case "medium": return 6;
    case "long": return 10;
    default: return 6;
  }
}
