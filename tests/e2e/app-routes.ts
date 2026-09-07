/**
 * App paths, DERIVED from the module registry (ADR-0005).
 *
 * This was a hand-maintained list with a "keep in sync when navigation changes"
 * comment on top. It had already drifted: /laboratory/artifacts was missing, so
 * the navigation matrix silently stopped covering a whole page. Deriving it
 * removes the class of bug rather than the instance.
 */
import { settingsSectionIds } from "../../src/lib/config-sections";
import { allModuleRoutes, documentedRoutes } from "../../src/lib/modules/registry";

export const APP_NAV_ROUTES: readonly string[] = allModuleRoutes();

/**
 * Every settings section, as the anchor it lives at on the one Settings page
 * (U11, T-0125). These are visited by config-sections.spec.ts so a section
 * that stopped rendering, or stopped being reachable by its anchor, is caught
 * the way a section page that 500'd used to be.
 */
export const CONFIG_SECTION_ANCHORS: readonly string[] = settingsSectionIds().map(
  (id) => `/agent/settings#${id}`,
);

/**
 * Routes for navigation-matrix (avoids duplicating every `/agent/settings/*`
 * visit; see `config-sections.spec.ts`). Identical to the set `docs:check`
 * demands a guide for, so it is taken from the registry rather than filtered
 * again here: two copies of the same filter is how the two sets drift.
 */
export const APP_MATRIX_ROUTES: readonly string[] = documentedRoutes();
