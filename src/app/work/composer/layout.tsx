// Server guard: when the `composer` flag is disabled, the page 404s — so it is
// not linkable and not served (the sidebar hides its link in parallel).
import { requireFeatureOr404 } from "@/lib/feature-flags-guard";

/**
 * Evaluated per request, never prerendered.
 *
 * PS_COMPOSER is a RUNTIME value, and a statically generated route bakes in
 * whatever it was at build time. Measured before this line existed: with the
 * flag off the route served the 404 page with an HTTP 200, because the
 * response was cached (`x-nextjs-cache: HIT`, `x-nextjs-prerender: 1`) and the
 * cached envelope carries the status of the render that produced it. The body a
 * person saw was right; the status a monitor, a crawler or a test saw was not,
 * and this repo's own documentation claims the route 404s (T-0054).
 *
 * The page is client-driven and data-fetched, so prerendering it bought nothing
 * to weigh against that.
 */
export const dynamic = "force-dynamic";

export default function ComposerLayout({ children }: { children: React.ReactNode }) {
  requireFeatureOr404("composer");
  return children;
}
