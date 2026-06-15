// ═══════════════════════════════════════════════════════════════
// story-handlers/edit.ts — POST actions "edit-chapter" / "extend" /
// "continue". Extracted from src/app/api/stories/route.ts (no logic change).
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

import { logApiError } from "@/lib/api-logger";
import { getStoryPrompt } from "@/lib/story-weaver/prompts";
import { callLLM } from "@/lib/llm";
import { getStory, updateStory } from "@/lib/story-repository";
import type { ChapterOutline } from "@/types/recroom";

import { safeArc, validateChapterOutput } from "./shared";

export async function handleEditChapter(body: Record<string, unknown>): Promise<NextResponse> {
  const { storyId, chapterNumber, editPrompt } = body;
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

  const editSystem = getStoryPrompt("chapter");
  const editUser = [
    "===EDIT INSTRUCTIONS===", editPrompt as string, "",
    "===EXISTING CHAPTER===", existingChapter, "",
    "===MASTER PROMPT===", story.masterPrompt ?? "", "",
    "===STORY ARC===", JSON.stringify(arc, null, 2), "",
    "===CHAPTER OUTLINE===", `Title: ${outline.title}\nPurpose: ${outline.purpose}`,
    "", "Rewrite this chapter. Return ONLY prose.",
  ].join("\n");

  try {
    const raw = (await callLLM([{ role: "system", content: editSystem }, { role: "user", content: editUser }], { temperature: 0.85, maxTokens: 4096 })).content;
    const content = validateChapterOutput(raw);

    const updatedChapters = [...story.chapters];
    updatedChapters[chIdx] = {
      ...updatedChapters[chIdx],
      status: "complete",
      wordCount: content.split(/\s+/).length,
      generatedAt: new Date().toISOString(),
    };

    // Invalidate downstream
    for (let i = chIdx + 1; i < updatedChapters.length; i++) {
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
        { temperature: 0.7, maxTokens: 1024 }
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

export async function handleExtend(body: Record<string, unknown>): Promise<NextResponse> {
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

export async function handleContinue(body: Record<string, unknown>): Promise<NextResponse> {
  const { storyId, direction, count } = body;
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
    const raw = (await callLLM([{ role: "system", content: continueSystem }, { role: "user", content: continueUser }], { temperature: 0.8, maxTokens: 2048 })).content;
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

    const updated = updateStory(storyId as string, { chapters: updatedChapters, storyArc: arc, status: "active" });
    return NextResponse.json({ data: updated });
  } catch (err) {
    logApiError("POST /api/stories", "continue", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Continuation failed" }, { status: 500 });
  }
}
