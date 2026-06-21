// Server guard: when the `composer` flag is disabled, the page 404s — so it is
// not linkable and not served (the sidebar hides its link in parallel).
import { requireFeatureOr404 } from "@/lib/feature-flags-guard";

export default function ComposerLayout({ children }: { children: React.ReactNode }) {
  requireFeatureOr404("composer");
  return children;
}
