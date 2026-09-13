// ═══════════════════════════════════════════════════════════════
// search/types.ts — shared web-search contracts (reused by DeepResearch +
// future tools). Free/local-first providers implement SearchProvider; the
// visit tool fetches a page's readable content.
// ═══════════════════════════════════════════════════════════════

/** One web search hit. */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** Pluggable search backend (duckduckgo | searxng | cloud adapters | none). */
export interface SearchProvider {
  readonly name: string;
  search(query: string, limit?: number): Promise<SearchResult[]>;
}

/** Extracted readable content for a visited page. */
export interface VisitedPage {
  url: string;
  title: string;
  content: string;
}
