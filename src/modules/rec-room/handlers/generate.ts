// ═══════════════════════════════════════════════════════════════
// story-handlers/generate.ts — POST actions "generate-chapter" /
// "retry-chapter" / "rewrite-chapter" (retry + rewrite reset state then
// delegate to generate). Extracted from src/app/api/stories/route.ts.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

import { logApiError } from "@/lib/api-logger";
import { getStoryPrompt } from "@/modules/rec-room/lib/prompts";
import { callLLM } from "@/lib/llm";
import { getStory, updateStory } from "@/modules/rec-room/lib/story-repository";
import { recordEvent } from "@/lib/analytics/record-event";
import type { ChapterOutline } from "@/modules/rec-room/types";

import {
  buildChapterPrompt,
  safeArc,
  storyModelId,
  type StoryCallOptions,
  validateChapterOutput,
} from "./shared";

export async function handleGenerateChapter(
  body: Record<string, unknown>,
  opts: StoryCallOptions = {},
): Promise<NextResponse> {
  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "Missing storyId" }, { status: 400 });

  const story = getStory(storyId as string);
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  const nextIdx = story.chapters.findIndex((c) => c.status === "pending");
  if (nextIdx === -1) {
    updateStory(storyId as string, { status: "complete" });
    const updated = getStory(storyId as string);
    return NextResponse.json({ data: { message: "All chapters complete", story: updated } });
  }

  // Optimistically set "writing" status so the UI shows a blue pulse immediately
  const optimisticChapters = [...story.chapters];
  optimisticChapters[nextIdx] = { ...optimisticChapters[nextIdx], status: "writing", error: undefined };
  updateStory(storyId as string, { chapters: optimisticChapters as typeof story.chapters });

  const nextNum = nextIdx + 1;
  const chapterOutline = ((story.storyArc ?? {}) as { chapterOutlines?: ChapterOutline[] }).chapterOutlines?.[nextIdx] ?? {
    number: nextNum, title: `Chapter ${nextNum}`, purpose: "Continue the story",
    keyBeats: [`Key event for chapter ${nextNum}`], emotionalTone: "Engaging",
  };

  // Continuity: feed the last up-to-2 chapters (not just the previous one) so
  // voice, tense, and freshly-established facts carry forward cleanly.
  const recentChapters: { number: number; content: string }[] = [];
  for (const n of [nextNum - 2, nextNum - 1]) {
    if (n >= 1) {
      const content = story.chapterContents[String(n)];
      if (content) recentChapters.push({ number: n, content });
    }
  }

  const arc = safeArc(story.storyArc);
  if (!arc) return NextResponse.json({ error: "Story arc not found" }, { status: 400 });

  const system = getStoryPrompt("chapter");
  const userMessage = buildChapterPrompt(
    story.masterPrompt ?? "",
    arc,
    story.rollingSummary ?? null,
    recentChapters,
    chapterOutline,
    story.chapters.length,
  );

  try {
    const raw = (await callLLM([{ role: "system", content: system }, { role: "user", content: userMessage }], { temperature: 0.85, maxTokens: 4096, modelId: storyModelId(story), spend: { source: "story", storyId: storyId as string }, signal: opts.signal })).content;
    const content = validateChapterOutput(raw);

    // Extract a descriptive chapter title from the generated content
    let generatedTitle = chapterOutline.title ?? `Chapter ${nextNum}`;
    const firstMeaningfulLine = (content: string): string => {
      const lines = content.split("\n").map(l => l.trim()).filter(Boolean);
      // Find first line that looks like a narrative sentence (not a dialogue, not a blank line)
      const narrative = lines.find(l => !l.startsWith('"') && !l.startsWith("'") && l.length > 15 && l.length < 80 && /[.!]$/.test(l) === false && /^(The |A |An |She |He |It |They |We |I |My |His |Her |Its |This |That )/.test(l));
      return narrative || lines[0] || `Chapter ${nextNum}`;
    };
    try {
      const titleSystem = "You are a story editor. Extract a short, evocative title (3-7 words) for this chapter. Return ONLY the title text, nothing else.";
      const titleRaw = (await callLLM([{ role: "system", content: titleSystem }, { role: "user", content: `Chapter content:\n${content.slice(0, 500)}` }], { temperature: 0.3, maxTokens: 32, modelId: storyModelId(story), spend: { source: "story", storyId: storyId as string }, signal: opts.signal })).content;
      const extracted = titleRaw.trim().replace(/^["']|["']$/g, "").slice(0, 80);
      if (extracted.length > 5) {
        generatedTitle = extracted;
      } else {
        // Fallback: extract from chapter content itself
        generatedTitle = firstMeaningfulLine(content);
      }
    } catch {
      // Fallback: extract from chapter content itself
      generatedTitle = firstMeaningfulLine(content);
    }

    const updatedChapters = [...story.chapters];
    updatedChapters[nextIdx] = {
      ...updatedChapters[nextIdx],
      title: generatedTitle,
      status: "complete",
      wordCount: content.split(/\s+/).length,
      generatedAt: new Date().toISOString(),
    };

    // Keep chapterOutlines in sync so future regenerate/edit uses the real title
    const arc = { ...(safeArc(story.storyArc)) };
    if (arc.chapterOutlines) {
      arc.chapterOutlines = arc.chapterOutlines.map((o, i) =>
        i === nextIdx ? { ...o, title: generatedTitle } : o
      );
    }

    const newContents = { ...story.chapterContents, [String(nextNum)]: content };

    // Update rolling summary
    let rollingSummary = story.rollingSummary ?? "";
    try {
      const summarySystem = getStoryPrompt("summary");
      rollingSummary = ((await callLLM(
        [{ role: "system", content: summarySystem }, { role: "user", content: `PREVIOUS SUMMARY:\n${rollingSummary}\n\nNEW CHAPTER (Chapter ${nextNum}):\n${content}\n\nUpdate the rolling summary.` }],
        { temperature: 0.7, maxTokens: 1024, modelId: storyModelId(story), spend: { source: "story", storyId: storyId as string }, signal: opts.signal }
      )).content);
    } catch (err) {
      logApiError("POST /api/stories", "rolling summary after chapter", err);
    }

    const allComplete = updatedChapters.every((c) => c.status === "complete");
    const updated = updateStory(storyId as string, {
      chapters: updatedChapters,
      chapterContents: newContents,
      rollingSummary,
      storyArc: arc,
      status: allComplete ? "complete" : "active",
    });

    recordEvent("story.chapter_generated", {
      entityType: "story",
      entityId: storyId as string,
      metadata: { chapter: nextNum },
    });
    if (allComplete) {
      recordEvent("story.completed", { entityType: "story", entityId: storyId as string });
    }
    return NextResponse.json({ data: { chapter: nextNum, content, story: updated } });
  } catch (err) {
    const updatedChapters = [...story.chapters];
    updatedChapters[nextIdx] = {
      ...updatedChapters[nextIdx],
      status: "failed",
      error: err instanceof Error ? err.message : "Generation failed",
    };
    updateStory(storyId as string, { chapters: updatedChapters as typeof story.chapters });
    logApiError("POST /api/stories", "generate-chapter", err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Generation failed",
    }, { status: 500 });
  }
}

export async function handleRetryChapter(
  body: Record<string, unknown>,
  opts: StoryCallOptions = {},
): Promise<NextResponse> {
  const { storyId, chapterNumber } = body;
  if (!storyId || !chapterNumber) {
    return NextResponse.json({ error: "Missing storyId or chapterNumber" }, { status: 400 });
  }

  const story = getStory(storyId as string);
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  const chIdx = (chapterNumber as number) - 1;
  if (chIdx < 0 || chIdx >= story.chapters.length) {
    return NextResponse.json({ error: "Invalid chapter number" }, { status: 400 });
  }

  if (story.chapters[chIdx].status !== "failed") {
    return NextResponse.json({ error: "Chapter is not in failed state" }, { status: 400 });
  }

  // Reset to pending and regenerate
  const updatedChapters = [...story.chapters];
  updatedChapters[chIdx] = { ...updatedChapters[chIdx], status: "pending", error: undefined };
  updateStory(storyId as string, { chapters: updatedChapters as typeof story.chapters });

  return handleGenerateChapter({ storyId }, opts);
}

export async function handleRewriteChapter(
  body: Record<string, unknown>,
  opts: StoryCallOptions = {},
): Promise<NextResponse> {
  const { storyId, chapterNumber } = body;
  if (!storyId || !chapterNumber) {
    return NextResponse.json({ error: "Missing storyId or chapterNumber" }, { status: 400 });
  }

  const story = getStory(storyId as string);
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  const chNum = chapterNumber as number;
  const chIdx = chNum - 1;
  if (chNum < 1 || chNum > story.chapters.length) {
    return NextResponse.json({ error: "Invalid chapter number" }, { status: 400 });
  }

  // Invalidate from chIdx forward
  const updatedChapters = story.chapters.map((c, i) =>
    i >= chIdx ? { ...c, status: i === chIdx ? "pending" : "pending", wordCount: 0, generatedAt: undefined } : c
  );
  updateStory(storyId as string, { chapters: updatedChapters as typeof story.chapters });

  return handleGenerateChapter({ storyId }, opts);
}
