// ═══════════════════════════════════════════════════════════════
// search/searxng.ts — self-hosted / local web search (SearXNG JSON API)
//
// Fully local + private when pointed at your own SearXNG instance
// (PS_SEARXNG_URL). Returns [] on any failure.
// ═══════════════════════════════════════════════════════════════

import type { SearchProvider, SearchResult } from "./types";

interface SearxngRow {
  title?: unknown;
  url?: unknown;
  content?: unknown;
}

export function searxngProvider(baseUrl: string): SearchProvider {
  return {
    name: "searxng",
    async search(query, limit = 8): Promise<SearchResult[]> {
      const url =
        baseUrl.replace(/\/$/, "") +
        "/search?" +
        new URLSearchParams({ q: query, format: "json" }).toString();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { "User-Agent": "PatterStage/1.0", Accept: "application/json" },
        });
        if (!res.ok) return [];
        const data = (await res.json()) as { results?: SearxngRow[] };
        const rows = Array.isArray(data.results) ? data.results : [];
        return rows
          .slice(0, limit)
          .map((r) => ({
            title: String(r.title ?? ""),
            url: String(r.url ?? ""),
            snippet: String(r.content ?? ""),
          }))
          .filter((r) => r.url.startsWith("http"));
      } catch {
        return [];
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
