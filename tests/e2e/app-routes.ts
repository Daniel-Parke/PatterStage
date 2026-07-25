/**
 * App paths, DERIVED from the module registry (ADR-0005).
 *
 * This was a hand-maintained list with a "keep in sync when navigation changes"
 * comment on top. It had already drifted: /laboratory/artifacts was missing, so
 * the navigation matrix silently stopped covering a whole page. Deriving it
 * removes the class of bug rather than the instance.
 */
import { allModuleRoutes } from "../../src/lib/modules/registry";

export const APP_NAV_ROUTES: readonly string[] = allModuleRoutes();

/** Config hub and YAML/file-backed section editors (subset of `APP_NAV_ROUTES`). */
export const CONFIG_SECTION_ROUTES: readonly string[] = APP_NAV_ROUTES.filter(
  (p) => p === "/config" || p.startsWith("/config/")
);

/** Routes for navigation-matrix (avoids duplicating every `/config/*` visit; see `config-sections.spec.ts`). */
export const APP_MATRIX_ROUTES: readonly string[] = APP_NAV_ROUTES.filter(
  (p) => p === "/config" || !p.startsWith("/config/")
);
