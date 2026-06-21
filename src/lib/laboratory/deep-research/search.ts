// ═══════════════════════════════════════════════════════════════
// laboratory/deep-research/search.ts — pluggable search providers
//
// The engine depends only on the SearchProvider interface. This pass ships the
// null provider (no external dependency) so DeepResearch runs LLM-only out of
// the box; serper/tavily/brave/searxng implementations slot in here next,
// configured via the credentials/config registry. resolveSearchProvider()
// picks one from env, defaulting to null.
// ═══════════════════════════════════════════════════════════════

import type { SearchProvider } from "./types";

/** No-op provider — returns no results. The default until one is configured. */
export const nullSearchProvider: SearchProvider = {
  name: "none",
  async search() {
    return [];
  },
};

/**
 * Resolve the active search provider. For now only the null provider exists;
 * once serper/tavily/etc. land they register here keyed off
 * `PS_RESEARCH_SEARCH_PROVIDER` (+ their API key in the credentials registry).
 */
export function resolveSearchProvider(): SearchProvider {
  // const which = (process.env.PS_RESEARCH_SEARCH_PROVIDER ?? "").trim().toLowerCase();
  // switch (which) { case "serper": return serperProvider(); ... }
  return nullSearchProvider;
}
