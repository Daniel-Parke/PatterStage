// ═══════════════════════════════════════════════════════════════
// story-handlers/crud.ts — POST actions "list" / "load" / "update" /
// "sync-titles" / "delete". Extracted from src/app/api/stories/route.ts.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

import { callLLM } from "@/lib/llm";
import { listStories, getStory, updateStory, deleteStory } from "@/modules/rec-room/lib/story-repository";

import { safeArc } from "./shared";

export async function handleList(): Promise<NextResponse> {
  try {
    const stories = listStories();
    return NextResponse.json({ data: { stories } });
  } catch {
    return NextResponse.json({ data: { stories: [] } });
  }
}

export async function handleLoad(body: Record<string, unknown>): Promise<NextResponse> {
  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
  const story = getStory(storyId as string);
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  return NextResponse.json({ data: story });
}

export async function handleUpdate(body: Record<string, unknown>): Promise<NextResponse> {
  const { storyId, ...fields } = body;
  if (!storyId) return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
  const story = updateStory(storyId as string, fields as Record<string, unknown>);
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  return NextResponse.json({ data: story });
}

// Backfill chapter titles from existing chapter content for stories that were
// generated before safeArc correctly parsed nested StoryArc data. Re-extracts
// titles via LLM and updates both chapters[N].title and
// storyArc.chapterOutlines[N].title in the DB.
export async function handleSyncTitles(body: Record<string, unknown>): Promise<NextResponse> {
  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "Missing storyId" }, { status: 400 });

  const story = getStory(storyId as string);
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  const chapters = story.chapters || [];
  const contents = story.chapterContents || {};

  // Find chapters that need title backfill (placeholder "Chapter N" titles)
  const needsSync = chapters.filter((c) =>
    c.status === "complete" && c.title === `Chapter ${c.number}`
  );

  if (needsSync.length === 0) {
    return NextResponse.json({ data: { story, synced: 0 } });
  }

  const updatedChapters = [...chapters];
  const arc = { ...(safeArc(story.storyArc) ?? {}) };
  const hasArc = arc && Object.keys(arc).length > 0;

  for (const chapter of needsSync) {
    const content = contents[String(chapter.number)];
    if (!content) continue;

    let title = `Chapter ${chapter.number}`;
    try {
      const titleSystem =
        "You are a story editor. Extract a short, evocative title (3-7 words) for this chapter. Return ONLY the title text, nothing else.";
      const titleRaw = (await callLLM(
        [{ role: "system", content: titleSystem },
         { role: "user", content: `Chapter content:\n${String(content).slice(0, 800)}` }],
        { temperature: 0.3, maxTokens: 32 }
      )).content.trim().replace(/^["']|["']$/g, "").slice(0, 80);

      if (titleRaw.length > 5) title = titleRaw;
    } catch { /* keep placeholder */ }

    // Update in-memory chapters array
    const idx = updatedChapters.findIndex((c) => c.number === chapter.number);
    if (idx !== -1) updatedChapters[idx] = { ...updatedChapters[idx], title };

    // Keep chapterOutlines in sync too
    if (hasArc && Array.isArray(arc.chapterOutlines)) {
      arc.chapterOutlines = arc.chapterOutlines.map((o) =>
        o.number === chapter.number ? { ...o, title } : o
      );
    }
  }

  // Persist to DB
  const updated = updateStory(storyId as string, {
    chapters: updatedChapters,
    ...(hasArc ? { storyArc: arc } : {}),
  });

  return NextResponse.json({ data: { story: updated, synced: needsSync.length } });
}

export async function handleDelete(body: Record<string, unknown>): Promise<NextResponse> {
  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
  const ok = deleteStory(storyId as string);
  if (!ok) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  return NextResponse.json({ data: { deleted: true } });
}
