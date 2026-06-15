// ═══════════════════════════════════════════════════════════════
// story-handlers/shared.ts — pure helpers shared by the story actions
//
// Extracted from src/app/api/stories/route.ts (no logic change): StoryArc
// shape-normalisation, LLM-output scrubbing, prompt builders, and the
// length→chapter-count map.
// ═══════════════════════════════════════════════════════════════

import type { StoryArc as StoryArcType, ChapterOutline } from "@/types/recroom";

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
      return inner as unknown as StoryArcType;
    }
  }

  // CASE 2: Normal (flat) StoryArc — storyArc is a string at top level
  if (
    typeof a.storyArc === "string" &&
    Array.isArray(a.fixedPlotPoints) &&
    Array.isArray(a.chapterOutlines)
  ) {
    return a as unknown as StoryArcType;
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

export function buildMasterPrompt(config: Record<string, unknown>): string {
  const wordRanges: Record<string, string> = {
    short: "800-1200", medium: "1200-1800", standard: "1800-2500",
    long: "2500-3500", epic: "3500-5000", marathon: "5000+",
  };
  const wcRange = wordRanges[(config.wordCountRange as string) || "standard"] || "1800-2500";

  const characters = (config.characters as Array<Record<string, string>>) || [];
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

export function buildChapterPrompt(
  masterPrompt: string,
  storyArc: StoryArcType,
  rollingSummary: string | null,
  previousChapter: string | null,
  outline: ChapterOutline,
): string {
  const parts: string[] = [];
  parts.push("===MASTER PROMPT===\n" + masterPrompt);
  parts.push("\n===STORY ARC===\n" + JSON.stringify(storyArc, null, 2));
  if (rollingSummary) { parts.push("\n===NARRATIVE SO FAR===\n" + rollingSummary); }
  if (previousChapter) { parts.push("\n===PREVIOUS CHAPTER===\n" + previousChapter); }
  parts.push("\n===CHAPTER OUTLINE===\n" +
    `Title: ${outline.title}\nPurpose: ${outline.purpose}\n` +
    `Key Beats: ${outline.keyBeats.join("; ")}\nEmotional Tone: ${outline.emotionalTone}` +
    (outline.setupForNext ? `\nSetup for Next: ${outline.setupForNext}` : "") +
    "\n\nWrite Chapter ${outline.number} now. Return ONLY prose."
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
