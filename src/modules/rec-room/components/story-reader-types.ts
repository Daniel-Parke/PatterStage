// ── Story reader types — the shapes the reader page and its parts share.
// Extracted verbatim from app/recroom/story-weaver/[id]/page.tsx.
// Story Weaver behaviour is out of scope for T-0011; these interfaces are
// copied, not changed.

export interface Chapter {
  number: number;
  title: string;
  status: string;
  wordCount: number;
  readStatus?: "writing" | "unread" | "read";
  generatedAt?: string | null;
  error?: string;
}

export interface StoryState {
  id: string;
  title: string;
  chapters: Chapter[];
  chapterContents?: Record<string, string>;
  storyArc?: unknown;
  rollingSummary?: string;
  status?: string;
  masterPrompt?: string;
  generationError?: string;
  config?: Record<string, unknown>;
  updatedAt?: string;
}

/** The reading register for the current theme, as ReaderSettings THEMES supplies it. */
export interface ReaderTheme {
  bg: string;
  text: string;
  panel: string;
  accent: string;
  rule: string;
}
