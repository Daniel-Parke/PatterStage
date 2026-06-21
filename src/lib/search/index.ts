// ═══════════════════════════════════════════════════════════════
// search/index.ts — resolve the active search provider
//
// Free/local-first. Default: DuckDuckGo (zero-config, no key). Point
// PS_SEARXNG_URL at a self-hosted SearXNG for fully-local search, or set
// PS_SEARCH_PROVIDER explicitly. Cloud adapters (serper/tavily/brave) slot in
// here later, keyed off the credentials registry.
// ═══════════════════════════════════════════════════════════════

import type { SearchProvider } from "./types";
import { duckduckgoProvider } from "./duckduckgo";
import { searxngProvider } from "./searxng";

export const nullSearchProvider: SearchProvider = {
  name: "none",
  async search() {
    return [];
  },
};

export function resolveSearchProvider(): SearchProvider {
  const which = (process.env.PS_SEARCH_PROVIDER ?? "").trim().toLowerCase();
  const searxngUrl = (process.env.PS_SEARXNG_URL ?? "").trim();

  if (which === "none") return nullSearchProvider;
  if (which === "searxng" && searxngUrl) return searxngProvider(searxngUrl);
  if (!which && searxngUrl) return searxngProvider(searxngUrl); // auto-prefer local when configured
  return duckduckgoProvider; // free zero-config default
}

export type { SearchProvider, SearchResult, VisitedPage } from "./types";
export { visitPage } from "./visit";
