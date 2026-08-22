// ═══════════════════════════════════════════════════════════════
// mission-composer-utils.ts — pure helpers for the mission composer
// ═══════════════════════════════════════════════════════════════
//
// Extracted from useMissionsPage so both the composer state hook
// (useMissionComposer) and the page hook (useMissionsPage) can import
// them without a circular dependency. Pure + localStorage helpers;
// each is unit-tested in isolation.

import type { MissionTemplate } from "@/components/missions/TemplateModals";

/** localStorage key for the most recently selected mission category */
const LAST_CATEGORY_KEY = "ps-last-mission-category";

/**
 * Read the legacy `categoryId` field from a `MissionTemplate`.
 *
 * The `MissionTemplate` interface (in `src/components/missions/TemplateModals.tsx`)
 * exposes `category: string` as the canonical category field, but the
 * legacy backend response shape also carries a `categoryId?: string`
 * field that several call sites need to read. This helper centralises
 * the cast + read + fallback discipline so a future "drop the legacy
 * shape" change lands in one place. The `?? fallback` preserves the
 * original `?? <default>` semantics at every call site.
 */
export function getCategoryIdFromTemplate(
  t: MissionTemplate,
  fallback: string | null = null,
): string | null {
  return (t as MissionTemplate & { categoryId?: string }).categoryId ?? fallback;
}

/**
 * Persist the user's last-selected mission category to localStorage.
 * Failing localStorage writes (quota, private-mode, disabled) are
 * silently ignored — the user-visible flow continues to work because
 * the in-memory `newCategoryId` state has already been set; we just
 * won't restore the same category on next mount.
 */
export function rememberLastCategory(id: string | null | undefined): void {
  if (!id) return;
  try {
    localStorage.setItem(LAST_CATEGORY_KEY, id);
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/**
 * Read the user's last-selected mission category from localStorage.
 * Mirrors `rememberLastCategory()` — same try/catch+ignore discipline.
 * Returns `null` on any failure (storage unavailable, parse error,
 * key missing).
 */
export function readLastCategory(): string | null {
  try {
    return localStorage.getItem(LAST_CATEGORY_KEY);
  } catch {
    return null;
  }
}
