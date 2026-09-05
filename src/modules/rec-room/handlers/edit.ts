// ═══════════════════════════════════════════════════════════════
// story-handlers/edit.ts — POST actions "edit-chapter" / "extend" /
// "continue". Extracted from src/app/api/stories/route.ts (no logic change).
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

import { logApiError } from "@/lib/api-logger";
import { getStoryPrompt } from "@/modules/rec-room/lib/prompts";
import { callLLM } from "@/lib/llm";
import { getStory, updateStory } from "@/modules/rec-room/lib/story-repository";
import type { ChapterOutline } from "@/modules/rec-room/types";

import {
  focusArcForChapter,
  safeArc,
  storyModelId,
  type StoryCallOptions,
  validateChapterOutput,
  wordRange,
} from "./shared";

export async function handleEditChapter(
  body: Record<string, unknown>,
  opts: StoryCallOptions = {},
): Promise<NextResponse> {
  const { storyId, chapterNumber, editPrompt, wordCountRange, count } = body;
  if (!storyId || !chapterNumber || !editPrompt) {
    return NextResponse.json({ error: "Missing storyId, chapterNumber, or editPrompt" }, { status: 400 });
  }

  const story = getStory(storyId as string);
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  const chNum = chapterNumber as number;
  const chIdx = chNum - 1;
  if (chIdx < 0 || chIdx >= story.chapters.length) {
    return NextResponse.json({ error: "Invalid chapter number" }, { status: 400 });
  }

  const existingChapter = story.chapterContents[String(chNum)] || "";
  const arc = safeArc(story.storyArc);
  const outline = arc?.chapterOutlines?.[chIdx] ?? {
    number: chNum, title: story.chapters[chIdx].title, purpose: "Continue", keyBeats: [], emotionalTone: "Engaging",
  };

  const arcText = arc ? focusArcForChapter(arc, chNum, story.chapters.length) : "(no arc)";
  const editSystem = getStoryPrompt("chapter");
  const editUser = [
    "===EDIT INSTRUCTIONS===", editPrompt as string, "",
    "===EXISTING CHAPTER===", existingChapter, "",
    "===MASTER PROMPT===", story.masterPrompt ?? "", "",
    "===STORY ARC (focused for this chapter)===", arcText, "",
    "===CHAPTER OUTLINE===", `Title: ${outline.title}\nPurpose: ${outline.purpose}`,
    // The modal's Chapter Length control was read by nobody (T-0108, D90).
    "", `Target length: ${wordRange(wordCountRange)} words.`,
    "", "Rewrite this chapter, preserving continuity and the fixed plot points above. Return ONLY prose.",
  ].join("\n");

  try {
    const raw = (await callLLM([{ role: "system", content: editSystem }, { role: "user", content: editUser }], { temperature: 0.85, maxTokens: 4096, modelId: storyModelId(story), spend: { source: "story", storyId: storyId as string }, signal: opts.signal })).content;
    const content = validateChapterOutput(raw);

    const updatedChapters = [...story.chapters];
    updatedChapters[chIdx] = {
      ...updatedChapters[chIdx],
      status: "complete",
      wordCount: content.split(/\s+/).length,
      generatedAt: new Date().toISOString(),
    };

    // Invalidate downstream, bounded by the modal's "Chapters to Regenerate"
    // control, which was also read by nobody (T-0108, D90). The edited chapter
    // is the first of the `count`, so `count - 1` follow it. An absent count
    // keeps the documented default: everything after it.
    const downstreamLimit =
      typeof count === "number" && Number.isFinite(count)
        ? Math.max(0, Math.min(count, updatedChapters.length - chIdx) - 1)
        : updatedChapters.length - chIdx - 1;
    for (let i = chIdx + 1; i <= chIdx + downstreamLimit; i++) {
      updatedChapters[i] = { ...updatedChapters[i], status: "pending", wordCount: 0, generatedAt: undefined };
    }

    const newContents = { ...story.chapterContents, [String(chNum)]: content };

    // Recompute rolling summary
    let rollingSummary = story.rollingSummary ?? "";
    try {
      const summarySystem = getStoryPrompt("summary");
      const chaptersUpToN = Object.entries(newContents)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([num, text]) => `Chapter ${num}:\n${text}`)
        .join("\n\n");
      rollingSummary = ((await callLLM(
        [{ role: "system", content: summarySystem }, { role: "user", content: `Create a rolling summary:\n\n${chaptersUpToN}` }],
        { temperature: 0.7, maxTokens: 1024, modelId: storyModelId(story), spend: { source: "story", storyId: storyId as string }, signal: opts.signal }
      )).content);
    } catch (err) {
      logApiError("POST /api/stories", "rolling summary rebuild", err);
    }

    const updated = updateStory(storyId as string, {
      chapters: updatedChapters,
      chapterContents: newContents,
      rollingSummary,
      status: "active",
    });

    return NextResponse.json({ data: { chapter: chNum, content, story: updated } });
  } catch (err) {
    logApiError("POST /api/stories", "edit-chapter", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Edit failed" }, { status: 500 });
  }
}

// No `opts`: extending a story only appends pending chapter rows. It calls no
// model, so there is nothing to bill and nothing to abort.
export async function handleExtend(
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const { storyId, additionalChapters } = body;
  if (!storyId || !additionalChapters) {
    return NextResponse.json({ error: "Missing storyId or additionalChapters" }, { status: 400 });
  }

  const story = getStory(storyId as string);
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  const addCount = additionalChapters as number;
  const startNum = story.chapters.length + 1;
  const updatedChapters = [...story.chapters];
  const arc = story.storyArc ?? { chapterOutlines: [] };

  for (let i = 0; i < addCount; i++) {
    const num = startNum + i;
    const outline = { number: num, title: `Chapter ${num}`, purpose: "Continue the story", keyBeats: [`Event ${num}`], emotionalTone: "Engaging" };
    (arc.chapterOutlines as ChapterOutline[]).push(outline);
    updatedChapters.push({ number: num, title: outline.title, status: "pending", wordCount: 0 });
  }

  const updated = updateStory(storyId as string, { chapters: updatedChapters, storyArc: arc, status: "active" });
  return NextResponse.json({ data: updated });
}

/** Replace the master prompt's Chapter Length line, or append it when it has none. */
function withChapterLength(prompt: string, range: string): string {
  const line = `Chapter Length: ${range} words per chapter`;
  return /^Chapter Length: .*$/m.test(prompt)
    ? prompt.replace(/^Chapter Length: .*$/m, line)
    : `${prompt}
${line}`;
}

export async function handleContinue(
  body: Record<string, unknown>,
  opts: StoryCallOptions = {},
): Promise<NextResponse> {
  const { storyId, direction, count, wordCountRange } = body;
  if (!storyId || !direction) {
    return NextResponse.json({ error: "Missing storyId or direction" }, { status: 400 });
  }

  const story = getStory(storyId as string);
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  if (story.status !== "complete") {
    return NextResponse.json({ error: "Can only continue completed stories" }, { status: 400 });
  }

  const addCount = (count as number) || 3;
  const startNum = story.chapters.length + 1;

  const continueSystem = `You are a story architect. Return ONLY a JSON array of chapter outlines with: number, title, purpose, keyBeats (array), emotionalTone.`;
  const continueUser = [
    "===EXISTING STORY ARC===", JSON.stringify(story.storyArc, null, 2), "",
    "===ROLLING SUMMARY===", story.rollingSummary ?? "", "",
    "===CONTINUATION DIRECTION===", direction as string, "",
    `Generate ${addCount} new chapter outlines starting from chapter ${startNum}.`,
  ].join("\n");

  try {
    const raw = (await callLLM([{ role: "system", content: continueSystem }, { role: "user", content: continueUser }], { temperature: 0.8, maxTokens: 2048, modelId: storyModelId(story), spend: { source: "story", storyId: storyId as string }, signal: opts.signal })).content;
    let outlines: ChapterOutline[] = [];
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) { try { outlines = JSON.parse(jsonMatch[0]); } catch {} }

    if (outlines.length < addCount) {
      for (let i = outlines.length; i < addCount; i++) {
        outlines.push({ number: startNum + i, title: `Chapter ${startNum + i}`, purpose: "Continue", keyBeats: [], emotionalTone: "Engaging" });
      }
    }
    if (outlines.length > addCount) { outlines = outlines.slice(0, addCount); }
    if (!outlines.length) {
      outlines = Array.from({ length: addCount }, (_, i) => ({ number: startNum + i, title: `Chapter ${startNum + i}`, purpose: "Continue", keyBeats: [], emotionalTone: "Engaging" }));
    }

    const updatedChapters = [...story.chapters];
    const arc = story.storyArc ?? { chapterOutlines: [] };
    for (const outline of outlines) {
      (arc.chapterOutlines as ChapterOutline[]).push(outline);
      updatedChapters.push({ number: outline.number, title: outline.title, status: "pending", wordCount: 0 });
    }

    // handleGenerateChapter builds every later prompt from the FROZEN master
    // prompt, so a new chapter length has to be written into it or the control
    // is dead for everything the continuation produces.
    const masterPrompt = wordCountRange
      ? withChapterLength(story.masterPrompt ?? "", wordRange(wordCountRange))
      : undefined;

    const updated = updateStory(storyId as string, {
      chapters: updatedChapters,
      storyArc: arc,
      status: "active",
      ...(masterPrompt === undefined ? {} : { masterPrompt }),
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    logApiError("POST /api/stories", "continue", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Continuation failed" }, { status: 500 });
  }
}
