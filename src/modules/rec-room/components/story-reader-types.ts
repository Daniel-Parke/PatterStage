// ── Story reader types — the shapes the reader page and its parts share.
// The reader's theme type lived here too: the five-field register (bg, text,
// panel, accent, rule) that ReaderSettings' THEMES supplied and every reader
// part took as a prop. The register is three tokens on the stylesheet now and the
// parts read them as classes, so there is nothing to pass (U12, T-0126).

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
