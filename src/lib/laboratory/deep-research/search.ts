// ═══════════════════════════════════════════════════════════════
// laboratory/deep-research/search.ts — re-export the shared search module
//
// Search now lives in @/lib/search (reused by Composer's Research stage and
// future tools). This thin re-export keeps DeepResearch's imports stable.
// ═══════════════════════════════════════════════════════════════

export { resolveSearchProvider } from "@/lib/search";
