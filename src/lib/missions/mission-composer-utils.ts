// ═══════════════════════════════════════════════════════════════
// mission-composer-utils.ts — pure helpers for the mission composer
// ═══════════════════════════════════════════════════════════════
//
// Shared by useMissionComposer and useMissionsPage, and kept out of both so
// neither hook imports the other.

import type { MissionTemplate } from "@/components/missions/TemplateModals";

/** localStorage key for the most recently selected mission category */
const LAST_CATEGORY_KEY = "ps-last-mission-category";

/**
 * Read the legacy `categoryId` field from a `MissionTemplate`.
 *
 * `MissionTemplate` exposes `category: string` as the canonical field, but the
 * legacy backend response shape also carries `categoryId?: string`, which
 * several call sites read. Centralised so a future "drop the legacy shape"
 * change lands in one place.
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

/** Read the user's last-selected mission category; `null` on any failure. */
export function readLastCategory(): string | null {
  try {
    return localStorage.getItem(LAST_CATEGORY_KEY);
  } catch {
    return null;
  }
}
