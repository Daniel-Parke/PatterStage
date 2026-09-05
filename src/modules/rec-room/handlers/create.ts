// ═══════════════════════════════════════════════════════════════
// story-handlers/create.ts — POST action "create"
// Generates the story arc + Chapter 1 and persists the draft. Extracted
// from src/app/api/stories/route.ts (no logic change).
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

import { logApiError } from "@/lib/api-logger";
import { getStoryPrompt } from "@/modules/rec-room/lib/prompts";
import { callLLM } from "@/lib/llm";
import { createStory, updateStory } from "@/modules/rec-room/lib/story-repository";
import { recordEvent } from "@/lib/analytics/record-event";
import type { StoryArc as StoryArcType, ChapterOutline } from "@/modules/rec-room/types";

import {
  buildMasterPrompt,
  getChapterCount,
  normaliseMood,
  safeArc,
  storyModelId,
  type StoryCallOptions,
  validateChapterOutput,
} from "./shared";

import { chapterTitle } from "../lib/chapter-title";
import { normaliseStoryCharacters } from "../lib/characters";
export async function handleCreate(
  body: Record<string, unknown>,
  opts: StoryCallOptions = {},
): Promise<NextResponse> {
  const { title, config } = body;
  // The boundary, whole (T-0087). T-0079 guarded characters; mood, title and
  // premise sat one field away, cast and unguarded. A string mood crashed with
  // an empty 500; an object title crashed on the SQLite bind; an object
  // premise became "[object Object]" in the prompt.
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return NextResponse.json({ error: "config must be an object with a premise" }, { status: 400 });
  }
  const rawCfg = config as Record<string, unknown>;
  if (typeof rawCfg.premise !== "string" || !rawCfg.premise.trim()) {
    return NextResponse.json({ error: "Missing premise (it must be text)" }, { status: 400 });
  }
  if (title !== undefined && title !== null && typeof title !== "string") {
    return NextResponse.json({ error: "title must be text" }, { status: 400 });
  }

  const cfg: Record<string, unknown> = { ...rawCfg, mood: normaliseMood(rawCfg.mood) };
  const masterPrompt = buildMasterPrompt({ ...cfg, title });
  const storyTitle = (typeof title === "string" && title.trim()) || "Untitled Story";

  // Create draft in SQLite first, born "generating": the status the UI has
  // always had a badge for, set by nothing until now. The boot sweep marks any
  // row still here after a restart as failed instead of leaving it "active"
  // with no chapters.
  const draft = createStory({
    title: storyTitle,
    config: cfg,
    masterPrompt,
    chapters: [],
    status: "generating",
  });
  recordEvent("story.created", { entityType: "story", entityId: draft.id });

  try {
    // Step 1: Generate Story Arc + Chapter 1
    const system = getStoryPrompt("arc");
    const userMessage = masterPrompt +
      "\n\nNumber of chapters: " + getChapterCount(cfg.length as string) +
      "\n\nGenerate the story arc and write Chapter 1 now.";

    const raw = (await callLLM([{ role: "system", content: system }, { role: "user", content: userMessage }], { temperature: 0.85, maxTokens: 4096, modelId: storyModelId({ config: cfg }), spend: { source: "story", storyId: draft.id }, signal: opts.signal })).content;
    let storyArc: StoryArcType | null = null;
    let chapter1 = "";

    const arcMatch = raw.match(/===ARC===\s*([\s\S]*?)(?===CHAPTER 1===|$)/);
    const chapterMatch = raw.match(/===CHAPTER 1===\s*([\s\S]*?)$/);

    if (arcMatch) {
      try {
        const jsonStr = arcMatch[1].trim();
        storyArc = JSON.parse(jsonStr);
      } catch {
        const jsonExtract = arcMatch[1].match(/\{[\s\S]*\}/);
        if (jsonExtract) {
          try { storyArc = JSON.parse(jsonExtract[0]); } catch {}
        }
      }
    }
    if (chapterMatch) { chapter1 = validateChapterOutput(chapterMatch[1]); }
    if (!storyArc) {
      const jsonMatch = raw.match(/\{[\s\S]*"storyArc"[\s\S]*"chapterOutlines"[\s\S]*\}/);
      if (jsonMatch) { try { storyArc = JSON.parse(jsonMatch[0]); } catch {} }
    }
    if (!chapter1 && !storyArc) { chapter1 = validateChapterOutput(raw); }

    // Regenerate if too short / looks like outline
    if (chapter1) {
      const wordCount = chapter1.split(/\s+/).filter(Boolean).length;
      const looksLikeOutline = /\*\*chapter|## chapter|\d+\.\s+\*\*|the chapter opens with|shall i continue/i.test(chapter1);
      if (wordCount < 400 || looksLikeOutline) {
        try {
          const regenUser = `Write ONLY the full prose text of Chapter 1. No summaries, no outlines. At least 800 words.\n\nStory: ${cfg.premise}`;
          chapter1 = validateChapterOutput(
            (await callLLM(
              [{ role: "system", content: system }, { role: "user", content: regenUser }],
              { temperature: 0.85, maxTokens: 4096, modelId: storyModelId({ config: cfg }), spend: { source: "story", storyId: draft.id }, signal: opts.signal }
            )).content
          )
        } catch {}
      }
    }

    const expectedChapters = getChapterCount(cfg.length as string);
    if (storyArc && (!storyArc.chapterOutlines || storyArc.chapterOutlines.length < expectedChapters)) {
      const existing = storyArc.chapterOutlines || [];
      storyArc.chapterOutlines = Array.from({ length: expectedChapters }, (_, i) =>
        existing[i] ?? {
          number: i + 1, title: `Chapter ${i + 1}`,
          purpose: i === 0 ? "Introduction" : i === expectedChapters - 1 ? "Resolution" : "Development",
          keyBeats: [`Key event for chapter ${i + 1}`], emotionalTone: "Engaging",
        }
      );
    }

    if (!storyArc) {
      storyArc = {
        storyArc: `A ${cfg.genre || "general"} story.`,
        fixedPlotPoints: Array.from({ length: expectedChapters }, (_, i) => ({ chapter: i + 1, event: `Chapter ${i + 1} advances the plot` })),
        // The second consumer of the same unchecked cast: this fallback runs
        // whenever the model's arc JSON fails to parse, and wrote
        // `name: undefined` into the persisted story (T-0079).
        characterArcs: normaliseStoryCharacters(cfg.characters).map(c => ({ name: c.name, startingState: c.description || "Unknown", journey: "Grows through challenges", endingState: "Transformed" })),
        worldRules: [cfg.setting ? `Setting: ${cfg.setting}` : "As described"],
        themes: [cfg.genre ? `Themes of ${cfg.genre}` : "Human nature"],
        chapterOutlines: Array.from({ length: expectedChapters }, (_, i) => ({
          number: i + 1, title: `Chapter ${i + 1}`,
          purpose: i === 0 ? "Introduction" : i === expectedChapters - 1 ? "Resolution" : "Development",
          keyBeats: [`Key event for chapter ${i + 1}`], emotionalTone: "Engaging",
        })),
      };
    }

    // Step 2: Rolling Summary
    let rollingSummary = "";
    try {
      const summarySystem = getStoryPrompt("summary");
      rollingSummary = ((await callLLM(
        [{ role: "system", content: summarySystem }, { role: "user", content: `NEW CHAPTER (Chapter 1):\n${chapter1}\n\nCreate the initial rolling summary.` }],
        { temperature: 0.7, maxTokens: 1024, modelId: storyModelId({ config: cfg }), spend: { source: "story", storyId: draft.id }, signal: opts.signal }
      )).content);
    } catch {
      rollingSummary = `Chapter 1 introduces the story. ${chapter1.slice(0, 200)}...`;
    }

    const chapters: Array<{ number: number; title: string; status: "pending" | "complete" | "writing" | "failed"; wordCount: number; generatedAt?: string; error?: string }> = storyArc.chapterOutlines.map((ch: ChapterOutline, i: number) => ({
      number: i + 1,
      // Bounded, not verbatim. The model's title is rendered in a heading and
      // in the reader's chapter nav, both single-line, and it arrived
      // unchecked: any length, newlines included, or empty (T-0071).
      title: chapterTitle(ch.title, i),
      status: i === 0 ? "complete" : "pending",
      wordCount: i === 0 ? chapter1.split(/\s+/).length : 0,
      generatedAt: i === 0 ? new Date().toISOString() : undefined,
    }));

    const allComplete = chapters.every((c: { status: string }) => c.status === "complete");

    const story = updateStory(draft.id, {
      masterPrompt,
      storyArc: safeArc(storyArc) as Record<string, unknown> | undefined,
      rollingSummary,
      chapters,
      chapterContents: chapter1 ? { "1": chapter1 } : {},
      status: allComplete ? "complete" : "active",
    });

    return NextResponse.json({ data: story });
  } catch (err) {
    updateStory(draft.id, {
      status: "failed",
      generationError: err instanceof Error ? err.message : "Creation failed",
    });
    logApiError("POST /api/stories", "create", err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Creation failed",
    }, { status: 500 });
  }
}
