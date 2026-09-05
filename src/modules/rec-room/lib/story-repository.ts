// ═══════════════════════════════════════════════════════════════
// story-repository.ts — Story CRUD via SQLite
// ═══════════════════════════════════════════════════════════════

import { getDb, inTransaction, uuid, now } from "@/lib/db";

export interface Story {
  id: string;
  title: string;
  config: Record<string, unknown>;
  /**
   * Derived from config.premise; never written back.
   *
   * StoryCard and the library row have always rendered it, and nothing ever
   * set it, so every card read blank (T-0108, D92). updateStory writes
   * `config`, so the derived field cannot drift from its source.
   */
  premise?: string;
  masterPrompt?: string;
  storyArc?: Record<string, unknown>;
  rollingSummary?: string;
  chapters: StoryChapter[];
  chapterContents: Record<string, string>;
  status: "generating" | "active" | "complete" | "failed";
  generationError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoryChapter {
  number: number;
  title: string;
  status: "pending" | "writing" | "complete" | "failed";
  wordCount: number;
  generatedAt?: string;
  error?: string;
}

interface StoryRow {
  id: string;
  title: string;
  config: string;
  master_prompt: string | null;
  story_arc: string | null;
  rolling_summary: string | null;
  chapters: string;
  chapter_contents: string;
  status: string;
  generation_error: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function rowToStory(row: StoryRow | undefined): Story | null {
  if (!row || row.deleted_at) return null;
  const config = JSON.parse(row.config || "{}") as Record<string, unknown>;
  return {
    id: row.id,
    title: row.title,
    config,
    premise: typeof config.premise === "string" ? config.premise : undefined,
    masterPrompt: row.master_prompt ?? undefined,
    storyArc: row.story_arc ? JSON.parse(row.story_arc) : undefined,
    rollingSummary: row.rolling_summary ?? undefined,
    chapters: JSON.parse(row.chapters || "[]"),
    chapterContents: JSON.parse(row.chapter_contents || "{}"),
    status: row.status as Story["status"],
    generationError: row.generation_error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── CRUD ─────────────────────────────────────────────────────

export function listStories(): Story[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM stories WHERE deleted_at IS NULL ORDER BY created_at DESC"
    )
    .all() as StoryRow[];
  return rows.map(rowToStory).filter(Boolean) as Story[];
}

export function getStory(id: string): Story | null {
  const row = getDb()
    .prepare("SELECT * FROM stories WHERE id = ?")
    .get(id) as StoryRow | undefined;
  return rowToStory(row);
}

export function createStory(data: {
  title: string;
  config: Record<string, unknown>;
  /**
   * Derived from config.premise; never written back.
   *
   * StoryCard and the library row have always rendered it, and nothing ever
   * set it, so every card read blank (T-0108, D92). updateStory writes
   * `config`, so the derived field cannot drift from its source.
   */
  premise?: string;
  masterPrompt?: string;
  storyArc?: Record<string, unknown>;
  chapters: StoryChapter[];
  chapterContents?: Record<string, string>;
  status?: Story["status"];
}): Story {
  const id = uuid();
  const ts = now();

  inTransaction(() => {
    getDb()
      .prepare(
        `INSERT INTO stories
           (id, title, config, master_prompt, story_arc, rolling_summary,
            chapters, chapter_contents, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.title,
        JSON.stringify(data.config),
        data.masterPrompt ?? null,
        data.storyArc ? JSON.stringify(data.storyArc) : null,
        null,
        JSON.stringify(data.chapters),
        JSON.stringify(data.chapterContents ?? {}),
        data.status ?? "active",
        ts,
        ts
      );
  });

  return getStory(id)!;
}

export function updateStory(
  id: string,
  updates: Partial<Omit<Story, "id" | "createdAt">>
): Story | null {
  const existing = getStory(id);
  if (!existing) return null;
  const ts = now();

  const merged: Story = { ...existing, ...updates, updatedAt: ts };

  inTransaction(() => {
    getDb()
      .prepare(
        `UPDATE stories SET
           title = ?, config = ?, master_prompt = ?, story_arc = ?,
           rolling_summary = ?, chapters = ?, chapter_contents = ?,
           status = ?, generation_error = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        merged.title,
        JSON.stringify(merged.config),
        merged.masterPrompt ?? null,
        merged.storyArc ? JSON.stringify(merged.storyArc) : null,
        merged.rollingSummary ?? null,
        JSON.stringify(merged.chapters),
        JSON.stringify(merged.chapterContents),
        merged.status,
        merged.generationError ?? null,
        ts,
        id
      );
  });

  return getStory(id);
}

export function deleteStory(id: string): boolean {
  const existing = getStory(id);
  if (!existing) return false;
  const ts = now();
  getDb()
    .prepare("UPDATE stories SET deleted_at = ? WHERE id = ?")
    .run(ts, id);
  return true;
}

/**
 * Boot sweep, the stories half of reconcileRunsOnBoot (T-0087).
 *
 * Creation and chapter generation spend minutes inside an LLM call. A process
 * that dies in that window leaves a story "generating" with no chapters, or a
 * chapter "writing" forever, and the UI reads both as still in flight. Nothing
 * is in flight after a restart; say so, and say why.
 */
export function reconcileStoriesOnBoot(): { failedStories: number; failedChapters: number } {
  const reason = "Generation was interrupted by a restart. Retry to continue.";
  const db = getDb();
  const ts = now();
  const stories = db
    .prepare(
      "UPDATE stories SET status = 'failed', generation_error = ?, updated_at = ? WHERE status = 'generating' AND deleted_at IS NULL",
    )
    .run(reason, ts).changes;

  let chapters = 0;
  const rows = db
    .prepare("SELECT id, chapters FROM stories WHERE deleted_at IS NULL AND chapters LIKE ?")
    .all('%"writing"%') as Array<{ id: string; chapters: string }>;
  for (const row of rows) {
    let parsed: StoryChapter[];
    try {
      parsed = JSON.parse(row.chapters) as StoryChapter[];
    } catch {
      continue;
    }
    let touched = false;
    const swept = parsed.map((c) => {
      if (c.status !== "writing") return c;
      touched = true;
      chapters += 1;
      return { ...c, status: "failed" as const, error: reason };
    });
    if (touched) {
      db.prepare("UPDATE stories SET chapters = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(swept), ts, row.id);
    }
  }
  return { failedStories: stories, failedChapters: chapters };
}
