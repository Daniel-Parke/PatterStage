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

function parseStoredJson(raw: string | null): unknown {
  try {
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readObject(raw: string | null): Record<string, unknown> | undefined {
  const parsed = parseStoredJson(raw);
  return isObject(parsed) ? parsed : undefined;
}

function isChapter(value: unknown): value is StoryChapter {
  return isObject(value)
    && typeof value.number === "number" && Number.isFinite(value.number)
    && typeof value.wordCount === "number" && Number.isFinite(value.wordCount)
    && typeof value.title === "string"
    && ["pending", "writing", "complete", "failed"].some((status) => status === value.status);
}

interface JsonSpan { start: number; end: number }
interface JsonEdit extends JsonSpan { text: string }

// Locate members only after JSON.parse has validated the document. Recovery must
// preserve unknown values verbatim, including numbers JavaScript cannot represent.
function jsonMemberSpans(raw: string): JsonSpan[] {
  const open = raw.search(/\S/);
  const close = raw.trimEnd().length - 1;
  if (!((raw[open] === "[" && raw[close] === "]") || (raw[open] === "{" && raw[close] === "}"))) {
    throw new Error("Story recovery could not locate JSON members");
  }
  const spans: JsonSpan[] = [];
  let start = open + 1, depth = 0, quoted = false, escaped = false;
  for (let i = start; i < close; i += 1) {
    const char = raw[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "[" || char === "{") depth += 1;
    else if (char === "]" || char === "}") depth -= 1;
    else if (char === "," && depth === 0) {
      spans.push({ start, end: i });
      start = i + 1;
    }
    if (depth < 0) throw new Error("Story recovery JSON nesting disagrees with validated document");
  }
  if (quoted || depth !== 0) throw new Error("Story recovery JSON boundaries disagree with validated document");
  if (raw.slice(start, close).trim()) spans.push({ start, end: close });
  return spans;
}

function applyJsonEdits(raw: string, edits: JsonEdit[]): string {
  for (const { start, end, text } of edits.sort((a, b) => b.start - a.start)) {
    raw = raw.slice(0, start) + text + raw.slice(end);
  }
  return raw;
}

function recoverChapterJson(raw: string, reason: string): string {
  const fields = new Map<string, JsonSpan>();
  for (const span of jsonMemberSpans(raw)) {
    const member = raw.slice(span.start, span.end);
    const key = /^\s*("(?:\\.|[^"\\])*")\s*:\s*/.exec(member);
    if (!key) throw new Error("Story recovery could not locate a validated property");
    fields.set(JSON.parse(key[1]), {
      start: span.start + key[0].length,
      end: span.start + member.trimEnd().length,
    });
  }
  const status = fields.get("status");
  if (!status) throw new Error("Story recovery could not locate the validated status");
  const error = fields.get("error");
  const close = raw.trimEnd().length - 1;
  return applyJsonEdits(raw, [
    { ...status, text: JSON.stringify("failed") },
    error ? { ...error, text: JSON.stringify(reason) }
      : { start: close, end: close, text: `,"error":${JSON.stringify(reason)}` },
  ]);
}

function rowToStory(row: StoryRow | undefined): Story | null {
  if (!row || row.deleted_at) return null;
  const config = readObject(row.config) ?? {};
  const chapters = parseStoredJson(row.chapters);
  return {
    id: row.id,
    title: row.title,
    config,
    premise: typeof config.premise === "string" ? config.premise : undefined,
    masterPrompt: row.master_prompt ?? undefined,
    storyArc: readObject(row.story_arc),
    rollingSummary: row.rolling_summary ?? undefined,
    chapters: Array.isArray(chapters) ? chapters.filter(isChapter) : [],
    chapterContents: Object.fromEntries(Object.entries(readObject(row.chapter_contents) ?? {})
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")),
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
  const stored = getDb().prepare("SELECT * FROM stories WHERE id = ?").get(id) as StoryRow | undefined;
  const existing = rowToStory(stored);
  if (!existing || !stored) return null;
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
        Object.hasOwn(updates, "config") ? JSON.stringify(merged.config) : stored.config,
        merged.masterPrompt ?? null,
        Object.hasOwn(updates, "storyArc") ? (merged.storyArc ? JSON.stringify(merged.storyArc) : null) : stored.story_arc,
        merged.rollingSummary ?? null,
        Object.hasOwn(updates, "chapters") ? JSON.stringify(merged.chapters) : stored.chapters,
        Object.hasOwn(updates, "chapterContents") ? JSON.stringify(merged.chapterContents) : stored.chapter_contents,
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
  return inTransaction(() => {
    const stories = db
      .prepare(
        "UPDATE stories SET status = 'failed', generation_error = ?, updated_at = ? WHERE status = 'generating' AND deleted_at IS NULL",
      )
      .run(reason, ts).changes;

    let chapters = 0;
    const rows = db
      .prepare("SELECT id, chapters FROM stories WHERE deleted_at IS NULL")
      .all() as Array<{ id: string; chapters: string }>;
    for (const row of rows) {
      const parsed = parseStoredJson(row.chapters);
      if (!Array.isArray(parsed)) continue;
      const spans = jsonMemberSpans(row.chapters);
      if (spans.length !== parsed.length) throw new Error("Story recovery member count disagrees with validated array");
      const edits: JsonEdit[] = [];
      parsed.forEach((c, index) => {
        if (!isChapter(c) || c.status !== "writing") return;
        const span = spans[index];
        edits.push({ ...span, text: recoverChapterJson(row.chapters.slice(span.start, span.end), reason) });
        chapters += 1;
      });
      if (edits.length) {
        db.prepare("UPDATE stories SET chapters = ?, updated_at = ? WHERE id = ?").run(applyJsonEdits(row.chapters, edits), ts, row.id);
      }
    }
    return { failedStories: stories, failedChapters: chapters };
  });
}
