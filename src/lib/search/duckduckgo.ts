// ═══════════════════════════════════════════════════════════════
// search/duckduckgo.ts — free, zero-config web search (HTML endpoint)
//
// Uses DuckDuckGo's keyless HTML endpoint and parses results best-effort.
// Returns [] on any failure (the research engine tolerates no results).
// ═══════════════════════════════════════════════════════════════

import type { SearchProvider, SearchResult } from "./types";
import { checkUrlShape } from "./url-guard";

const ENDPOINT = "https://html.duckduckgo.com/html/";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}
function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}
function unwrapHref(href: string): string {
  try {
    const u = new URL(href, "https://duckduckgo.com");
    const uddg = u.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : href.startsWith("http") ? href : `https:${href}`;
  } catch {
    return href;
  }
}

export const duckduckgoProvider: SearchProvider = {
  name: "duckduckgo",
  async search(query, limit = 8): Promise<SearchResult[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (compatible; PatterStage/1.0)",
        },
        body: new URLSearchParams({ q: query }).toString(),
        signal: controller.signal,
      });
      if (!res.ok) return [];
      const html = await res.text();
      const results: SearchResult[] = [];
      const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null && results.length < limit) {
        const url = unwrapHref(m[1]);
        if (!url.startsWith("http")) continue;
        // Drop internal/loopback targets at PARSE time, not just at fetch time.
        // The `uddg=` parameter is redirect data we do not control, and filtering
        // only when visiting would still surface e.g. http://127.0.0.1:8642 as a
        // numbered citation in the report's Sources panel.
        if (!checkUrlShape(url).ok) continue;
        const title = stripTags(m[2]);
        const after = html.slice(m.index, m.index + 2000);
        const snippetM = after.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
        results.push({ title, url, snippet: snippetM ? stripTags(snippetM[1]) : "" });
      }
      return results;
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  },
};
