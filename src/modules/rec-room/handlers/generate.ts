// ═══════════════════════════════════════════════════════════════
// story-handlers/generate.ts — POST actions "generate-chapter" /
// "retry-chapter" / "rewrite-chapter" (retry + rewrite reset state then
// delegate to generate). Extracted from src/app/api/stories/route.ts.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

import { logApiError } from "@/lib/api/api-logger";
import { getStoryPrompt } from "@/modules/rec-room/lib/prompts";
import { callLLM } from "@/lib/models/llm";
import { getStory, updateStory, type StoryChapter } from "@/modules/rec-room/lib/story-repository";
import { recordEvent } from "@/lib/analytics/record-event";
import type { ChapterOutline } from "@/modules/rec-room/types";

import {
  buildChapterPrompt,
  safeArc,
  storyModelId,
  type StoryCallOptions,
  validateChapterOutput,
} from "./shared";

/**
 * What a stopped chapter answers with: the request was closed by the caller,
 * not failed by this server, and 500 said the opposite. 499 is nginx's "Client
 * Closed Request". Nobody is usually listening (the reader stopped this by
 * aborting the request), so this is for the logs and for any caller that does
 * wait (T-0113).
 */
const CHAPTER_STOPPED_STATUS = 499;

/**
 * Was this a Stop, or a failure?
 *
 * The SIGNAL answers it, not the error's name. The gateway path's own
 * five-minute timeout also surfaces as an AbortError, and reading a real
 * timeout as a Stop would leave a chapter quietly pending with nothing on
 * screen to say the write had failed.
 */
function wasStopped(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

/**
 * A row a CALLER changed before delegating, and wants back if this call is
 * stopped.
 *
 * handleRetryChapter resets its chapter to pending before delegating, so "as
 * it was" is a row this function can no longer read. Restoring it inside the
 * stop's own write, rather than after the delegate returns, matters: the
 * reader re-reads the story the moment it stops one, and every extra write in
 * between is a window in which it can read the transient row instead.
 */
interface StoppedRestore {
  index: number;
  chapter: StoryChapter;
}

export async function handleGenerateChapter(
  body: Record<string, unknown>,
  opts: StoryCallOptions = {},
  restoreOnStop?: StoppedRestore,
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

  // The row as it stood before this call touched it. A Stop puts it back
  // exactly as it was, so nothing about the chapter records an attempt that
  // was cancelled rather than tried.
  const beforeThisCall = story.chapters[nextIdx];

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

    // A Stop is not a failure, and this is where that had to become true of
    // the SERVER and not just of the reader's comments. Marking a stopped
    // chapter "failed" cost money twice over: the write action names no
    // chapter, so the next press skipped this one and billed the chapter after
    // it, leaving a hole that breaks continuity (buildChapterPrompt feeds
    // chapters n-2/n-1); and the error it wrote was the provider's timeout
    // advice, blaming a base URL that was never wrong (T-0113).
    if (wasStopped(opts.signal)) {
      updatedChapters[nextIdx] = beforeThisCall;
      // The caller's row goes back last, because a caller that changed one has
      // the older and truer version of it. Usually the same index; not always,
      // since the chapter this call picked is the first PENDING one.
      if (restoreOnStop) updatedChapters[restoreOnStop.index] = restoreOnStop.chapter;
      updateStory(storyId as string, { chapters: updatedChapters as typeof story.chapters });
      return NextResponse.json({
        error: "The chapter was stopped before it was written.",
        stopped: true,
      }, { status: CHAPTER_STOPPED_STATUS });
    }

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

  // What the operator was reading before pressing Retry. Resetting the row to
  // pending is this handler's doing, so a Stop has to undo it: the error text
  // is the only record of WHY the chapter failed, and a stopped retry used to
  // overwrite it with the abort's message (T-0113).
  const beforeTheRetry = story.chapters[chIdx];

  // Reset to pending and regenerate
  const updatedChapters = [...story.chapters];
  updatedChapters[chIdx] = { ...updatedChapters[chIdx], status: "pending", error: undefined };
  updateStory(storyId as string, { chapters: updatedChapters as typeof story.chapters });

  // Handed down, not applied afterwards, so it lands only on the stop path. An
  // abort that arrives after the provider answered still completes and bills
  // the chapter (the title and summary calls are both caught), and putting the
  // old failure back over THAT would throw away writing already paid for.
  return handleGenerateChapter({ storyId }, opts, { index: chIdx, chapter: beforeTheRetry });
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
