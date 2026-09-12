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

/**
 * Resolve the search provider. An explicit `override` (chosen per-run in the
 * Deep Research UI) wins; otherwise fall back to env (PS_SEARCH_PROVIDER /
 * PS_SEARXNG_URL). Unknown names fall through to the free DuckDuckGo default.
 */
export function resolveSearchProvider(override?: string): SearchProvider {
  const which = (override ?? process.env.PS_SEARCH_PROVIDER ?? "").trim().toLowerCase();
  const searxngUrl = (process.env.PS_SEARXNG_URL ?? "").trim();

  if (which === "none") return nullSearchProvider;
  if (which === "duckduckgo") return duckduckgoProvider;
  if (which === "searxng" && searxngUrl) return searxngProvider(searxngUrl);
  if (!which && searxngUrl) return searxngProvider(searxngUrl); // auto-prefer local when configured
  return duckduckgoProvider; // free zero-config default
}

export type { SearchProvider } from "./types";
export { visitPage } from "./visit";
