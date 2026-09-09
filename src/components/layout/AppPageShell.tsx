// App Page Shell — the page frame, and the one container that owns the left edge.
//
// This used to be a background only, and 23 routes produced seven content
// widths and eight gutters, with the h1 off the content's left edge on 21 of
// them: a missing structure, not twenty mistakes. The header is a PROP because
// a bar must be both full-bleed and contained; the shell renders the bar and
// puts the header's content in the SAME container as the body.

import type { ReactNode } from "react";

import { shellHeaderBarClasses } from "@/lib/theme";

/**
 * What happens INSIDE the container, never what the container is. `board` is
 * the default; `prose` is a narrower column LEFT aligned inside the page
 * container, because a second centred container is what moves one screen's
 * content 400px from its neighbour's; `pane` fills the height and scrolls itself.
 */
// Not exported: every call site spells the literal, and an alias with no readers is what this programme deletes.
type PageDensity = "board" | "prose" | "pane";

interface AppPageShellProps {
  children: ReactNode;
  /** The page's header content, usually a <PageHeader>. Rendered in the bar. */
  header?: ReactNode;
  density?: PageDensity;
  /** Adds `.scanlines` overlay (requires parent `relative` for pseudo-element). */
  variant?: "default" | "scanlines";
  className?: string;
}

/**
 * The measure, and the only thing that decides a left edge; one string used
 * verbatim in both places. The density's classes go on a CHILD, never the same
 * element: `max-w-ps-page` and `max-w-ps-prose` together are decided by
 * stylesheet order. The gutter narrows on a phone (24px each side of 375px is
 * 13% of it); it is still one string, so every screen keeps the same left edge.
 */
export const PAGE_MEASURE = "mx-auto w-full max-w-ps-page px-4 sm:px-6";

/** Two steps, not the eight the census measured: 32px between sections, 16px inside one. */
const DENSITY: Record<PageDensity, string> = {
  board: "py-6 space-y-8",
  prose: "py-8 space-y-8 max-w-ps-prose",
  pane: "flex-1 min-h-0 flex flex-col",
};

export default function AppPageShell({
  children,
  header,
  density = "board",
  variant = "default",
  className = "",
}: AppPageShellProps) {
  const fx = variant === "scanlines" ? "relative scanlines" : "";
  return (
    <div
      className={`min-h-screen bg-ps-surface-ground grid-bg flex flex-col ${fx} ${className}`.trim()}
    >
      {header ? (
        // Sticky and full-bleed: the BAR spans the viewport, the container inside is what the words line up with.
        <header className={`${shellHeaderBarClasses} sticky top-0 z-sticky w-full`}>
          <div data-ps-container className={PAGE_MEASURE}>
            {header}
          </div>
        </header>
      ) : null}
      <div
        data-ps-container
        className={`${PAGE_MEASURE} ${density === "pane" ? "flex flex-1 flex-col min-h-0" : ""}`.trim()}
      >
        <div data-ps-density={density} className={DENSITY[density]}>
          {children}
        </div>
      </div>
    </div>
  );
}
