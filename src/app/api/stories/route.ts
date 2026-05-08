// ═══════════════════════════════════════════════════════════════
// /api/stories — Story Weaver CRUD (SQLite storage)
// All LLM generation logic preserved; storage moved to SQLite.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { logApiError } from "@/lib/api-logger";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { getStoryPrompt } from "@/lib/story-weaver/prompts";
import { callLLM } from "@/lib/llm";
import {
  listStories,
  getStory,
  createStory,
  updateStory,
  deleteStory,
} from "@/lib/story-repository";
import type { StoryArc as StoryArcType, ChapterOutline } from "@/types/recroom";

// ── Response Validation ────────────────────────────────────────

function validateChapterOutput(raw: string): string {
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

// ── Build Master Prompt ───────────────────────────────────────

function buildMasterPrompt(config: Record<string, unknown>): string {
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

// ── POST Handler ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ro = requireNotReadOnly();
  if (ro) return ro;
  const auth = requireMcApiKey(request);
  if (auth) return auth;

  try {
    const body = await request.json();
    const { action } = body;
    switch (action) {
      case "create":    return handleCreate(body);
      case "list":      return handleList();
      case "load":      return handleLoad(body);
      case "generate-chapter":  return handleGenerateChapter(body);
      case "retry-chapter":     return handleRetryChapter(body);
      case "rewrite-chapter":   return handleRewriteChapter(body);
      case "edit-chapter":      return handleEditChapter(body);
      case "extend":            return handleExtend(body);
      case "continue":          return handleContinue(body);
      case "update":            return handleUpdate(body);
      case "delete":            return handleDelete(body);
      default:
        return NextResponse.json({ error: "Unknown action: " + action }, { status: 400 });
    }
  } catch (err) {
    logApiError("POST /api/stories", "request", err);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}

// ── Create ───────────────────────────────────────────────────

async function handleCreate(body: Record<string, unknown>): Promise<NextResponse> {
  const { title, config } = body;
  if (!config || !(config as Record<string, unknown>)?.premise) {
    return NextResponse.json({ error: "Missing premise" }, { status: 400 });
  }

  const cfg = config as Record<string, unknown>;
  const masterPrompt = buildMasterPrompt({ ...cfg, title });
  const storyId = "story_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
  const storyTitle = (title as string) || "Untitled Story";

  // Create draft in SQLite first
  const draft = createStory({
    title: storyTitle,
    config: cfg,
    masterPrompt,
    chapters: [],
  });

  try {
    // Step 1: Generate Story Arc + Chapter 1
    const system = getStoryPrompt("arc");
    const userMessage = masterPrompt +
      "\n\nNumber of chapters: " + getChapterCount(cfg.length as string) +
      "\n\nGenerate the story arc and write Chapter 1 now.";

    const raw = (await callLLM([{ role: "system", content: system }, { role: "user", content: userMessage }], { temperature: 0.85, maxTokens: 4096 })).content;
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
              { temperature: 0.85, maxTokens: 4096 }
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
        characterArcs: ((cfg.characters as Array<Record<string, string>>) || []).map(c => ({ name: c.name, startingState: c.description || "Unknown", journey: "Grows through challenges", endingState: "Transformed" })),
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
        { temperature: 0.7, maxTokens: 1024 }
      )).content);
    } catch {
      rollingSummary = `Chapter 1 introduces the story. ${chapter1.slice(0, 200)}...`;
    }

    const chapters: Array<{ number: number; title: string; status: "pending" | "complete" | "writing" | "failed"; wordCount: number; generatedAt?: string; error?: string }> = storyArc.chapterOutlines.map((ch: ChapterOutline, i: number) => ({
      number: i + 1,
      title: ch.title,
      status: i === 0 ? "complete" : "pending",
      wordCount: i === 0 ? chapter1.split(/\s+/).length : 0,
      generatedAt: i === 0 ? new Date().toISOString() : undefined,
    }));

    const allComplete = chapters.every((c: { status: string }) => c.status === "complete");

    const story = updateStory(draft.id, {
      masterPrompt,
      storyArc: storyArc as unknown as Record<string, unknown>,
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

// ── Generate Chapter ────────────────────────────────────────

async function handleGenerateChapter(body: Record<string, unknown>): Promise<NextResponse> {
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

  const prevChapter = nextNum > 1 ? story.chapterContents[String(nextNum - 1)] ?? null : null;

  const system = getStoryPrompt("chapter");
  const userMessage = buildChapterPrompt(
    story.masterPrompt ?? "",
    story.storyArc as unknown as StoryArcType,
    story.rollingSummary ?? null,
    prevChapter,
    chapterOutline
  );

  try {
    const raw = (await callLLM([{ role: "system", content: system }, { role: "user", content: userMessage }], { temperature: 0.85, maxTokens: 4096 })).content;
    const content = validateChapterOutput(raw);

    // Extract a descriptive chapter title from the generated content
    let generatedTitle = chapterOutline.title;
    try {
      const titleSystem = "You are a story editor. Extract a short, evocative title (3-7 words) for this chapter. Return ONLY the title text, nothing else.";
      const titleRaw = (await callLLM([{ role: "system", content: titleSystem }, { role: "user", content: `Chapter content:\n${content.slice(0, 500)}` }], { temperature: 0.3, maxTokens: 32 })).content;
      const extracted = titleRaw.trim().replace(/^["']|["']$/g, "").slice(0, 80);
      if (extracted.length > 5) generatedTitle = extracted;
    } catch { /* keep outline title on failure */ }

    const updatedChapters = [...story.chapters];
    updatedChapters[nextIdx] = {
      ...updatedChapters[nextIdx],
      title: generatedTitle,
      status: "complete",
      wordCount: content.split(/\s+/).length,
      generatedAt: new Date().toISOString(),
    };

    // Keep chapterOutlines in sync so future regenerate/edit uses the real title
    const arc = { ...(story.storyArc as unknown as StoryArcType) };
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
        { temperature: 0.7, maxTokens: 1024 }
      )).content);
    } catch {}

    const allComplete = updatedChapters.every((c) => c.status === "complete");
    const updated = updateStory(storyId as string, {
      chapters: updatedChapters,
      chapterContents: newContents,
      rollingSummary,
      storyArc: arc,
      status: allComplete ? "complete" : "active",
    });

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

function buildChapterPrompt(
  masterPrompt: string,
  storyArc: StoryArcType,
  rollingSummary: string | null,
  previousChapter: string | null,
  outline: ChapterOutline
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

// ── Retry Chapter ────────────────────────────────────────────

async function handleRetryChapter(body: Record<string, unknown>): Promise<NextResponse> {
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

  return handleGenerateChapter({ storyId });
}

// ── Rewrite / Edit Chapter ─────────────────────────────────

async function handleRewriteChapter(body: Record<string, unknown>): Promise<NextResponse> {
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

  return handleGenerateChapter({ storyId });
}

async function handleEditChapter(body: Record<string, unknown>): Promise<NextResponse> {
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
  const arc = story.storyArc as unknown as StoryArcType;
  const outline = arc.chapterOutlines?.[chIdx] ?? {
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
    } catch {}

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

// ── Extend / Continue ──────────────────────────────────────

async function handleExtend(body: Record<string, unknown>): Promise<NextResponse> {
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

async function handleContinue(body: Record<string, unknown>): Promise<NextResponse> {
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

// ── Helpers ─────────────────────────────────────────────────

function getChapterCount(length: string): number {
  switch (length) {
    case "short": return 3;
    case "medium": return 6;
    case "long": return 10;
    default: return 6;
  }
}

// ── List ─────────────────────────────────────────────────────

async function handleList(): Promise<NextResponse> {
  try {
    const stories = listStories();
    return NextResponse.json({ data: { stories } });
  } catch {
    return NextResponse.json({ data: { stories: [] } });
  }
}

// ── Load ───────────────────────────────────────────────────

async function handleLoad(body: Record<string, unknown>): Promise<NextResponse> {
  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
  const story = getStory(storyId as string);
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  return NextResponse.json({ data: story });
}

// ── Update ─────────────────────────────────────────────────

async function handleUpdate(body: Record<string, unknown>): Promise<NextResponse> {
  const { storyId, ...fields } = body;
  if (!storyId) return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
  const story = updateStory(storyId as string, fields as Record<string, unknown>);
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  return NextResponse.json({ data: story });
}

// ── Delete ─────────────────────────────────────────────────

async function handleDelete(body: Record<string, unknown>): Promise<NextResponse> {
  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
  const ok = deleteStory(storyId as string);
  if (!ok) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  return NextResponse.json({ data: { deleted: true } });
}
