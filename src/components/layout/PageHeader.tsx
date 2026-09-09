// ═══════════════════════════════════════════════════════════════
// Page Header — the header's CONTENT, not the bar it sits in
// ═══════════════════════════════════════════════════════════════
//
// This used to render its own <header>: sticky, full-width, with its own
// padding. That made the header a CHILD of the page, and a child cannot be both
// full-bleed and contained. The bar therefore either stopped short of the
// viewport (on /results/artifacts its bottom rule ended 180px from both edges,
// pointing at nothing) or the words inside it sat at a different x from the
// content beneath. AppPageShell now renders the bar and puts this content in the
// SAME container as the body, so the two edges cannot disagree.

"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { AccentColor } from "@/types/console";
import { iconColorMap } from "@/lib/theme";
import { StatusDot } from "@/components/ui/Card";
import PageTitle, { useRegistryTitle } from "@/components/layout/PageTitle";
import HelpLink from "@/components/help/HelpLink";

interface PageHeaderProps {
  icon: React.ComponentType<{ className?: string }>;
  /**
   * The page's name. Omit it and the header reads the registry's label for
   * the current path, which is what keeps the rail entry, the h1 and the tab
   * title one word (T-0097, D55). Pass one only when the header names a thing
   * rather than a place.
   */
  title?: string;
  subtitle?: string;
  color?: AccentColor;
  backHref?: string;
  backLabel?: string;
  /** When true, show only the back arrow (no BACK label). */
  backIconOnly?: boolean;
  status?: "online" | "warning" | "error" | "idle";
  actions?: React.ReactNode;
}

/**
 * Prose in Inter, a count in mono (decision 10, T-0132). The subtitle was
 * `font-mono text-micro` on every screen, which set "Talk to your Hermes
 * agent" as if it were a path and was the largest single contributor to the
 * mono share the census counts. A token is a count when it is digits, with
 * the dots, commas and colons a number or a clock carries; a digit inside a
 * word ("gpt-4o") is part of the word and stays in it.
 */
function subtitleNodes(text: string): React.ReactNode[] {
  return text.split(/(\s+)/).map((token, i) =>
    /^\d[\d.,:]*$/.test(token) ? (
      <span key={i} className="font-mono tabular-nums">
        {token}
      </span>
    ) : (
      token
    ),
  );
}

export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  color = "cyan",
  backHref,
  backLabel = "BACK",
  backIconOnly = false,
  status,
  actions,
}: PageHeaderProps) {
  const resolved = useRegistryTitle(title);
  return (
    // flex-wrap, because on a phone the actions alone can be wider than the
    // bar: Logs measures 388px of pickers and buttons inside 390px. With
    // nothing to share, the title group was rendering 0px wide. Wrapping puts
    // the actions on a second row instead of erasing the page's own name.
    <div className="flex w-full flex-wrap items-center justify-between gap-4 py-3">
      <PageTitle title={resolved} />
      {/* flex-1, not just min-w-0: min-w-0 lets this group shrink past its
          content, and with the actions marked shrink-0 there was nothing to
          stop it reaching zero. On a phone the busiest headers rendered
          their h1 0px wide. Growing claims the leftover space instead, and
          the truncate on the h1 handles what is left.

          The 16rem floor is what makes the actions WRAP rather than the words
          clip: with a picker and a primary button beside it, the Tools header
          squeezed its subtitle to 292px and cut the count off (T-0125). Below
          the floor the actions take a second row, which is what the wrap was
          for. At 390px the floor still leaves room, because it is the title
          group's minimum and not the bar's. */}
      <div className="flex min-w-0 flex-1 flex-col sm:min-w-[16rem]">
        {backHref && (
          // Its own row ABOVE the title, not a column beside it. Beside it, the
          // back link and its divider push the h1 to the right of the content
          // column underneath — which is the offset this batch exists to
          // remove. A fixed-width slot would only make that offset the same on
          // every page rather than zero, and the gate measures zero.
          <Link
            href={backHref}
            // min-h-6 and min-w-6: a 14px arrow and a 12px word made a 16px-tall
            // target on every page with a way back, and below sm, where the word
            // is hidden, a 14px-wide one (T-0127).
            className="mb-1 flex min-h-6 min-w-6 w-fit items-center gap-1.5 text-ps-text-muted transition-colors hover:text-ps-text-primary"
            // Always named, because the label is hidden below sm and a link
            // whose text disappears at a breakpoint would otherwise be an
            // unnamed arrow on a phone.
            aria-label={backLabel}
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
            {/* Hidden below sm, not removed: on a 390px screen the page's own
                name is worth more than the word for where you came from, and
                the arrow still says it. */}
            {!backIconOnly && (
              <span className="hidden font-mono text-micro sm:inline">{backLabel}</span>
            )}
          </Link>
        )}
        {/* The icon is INSIDE the h1. Beside it, the h1's box started one icon
            and one gap to the right of every block below it, so every screen
            with a header disagreed with itself by 32px before anything else
            went wrong. In here, the heading's left edge IS the container's. */}
        <h1 className="flex items-center gap-3 text-title font-bold tracking-tight text-ps-text-primary">
          <Icon className={`h-5 w-5 shrink-0 ${iconColorMap[color]}`} />
          <span className="truncate">{resolved}</span>
          {status && <StatusDot status={status} pulse />}
        </h1>
        {subtitle && (
          // ml-8 is not a guess: the icon is h-5 (1.25rem) and the gap is
          // gap-3 (0.75rem), so 2rem is exactly the title text's own indent.
          // The subtitle reads as belonging to the title rather than to the
          // icon.
          // Truncated from sm up, where the header is one line and the row of
          // actions sits beside it; below sm it wraps, because an ellipsis on
          // a phone hid the words on every screen (T-0127 carried, T-0128).
          // Body prose, not a micro machine word: see subtitleNodes.
          <p className="ml-8 text-body text-ps-text-muted sm:truncate">{subtitleNodes(subtitle)}</p>
        )}
      </div>
      {/*
        The ? is here rather than on each page, and the wrapper is always
        rendered rather than conditional on `actions`, so a page that passes no
        actions is not also a page with no way into its guide. There is no prop
        to opt out with: an opt-out is how a screen quietly loses its guide.
      */}
      {/* max-w-full and flex-wrap on the slot itself: shrink-0 keeps the
          title from being squeezed, but four actions side by side are 490px
          on Tools, and a shrink-0 row that cannot wrap is wider than a phone.
          The row takes its own second line now, main stays inside its box
          (T-0128).

          basis-full below sm: the 16rem floor above is sm: too, so at 390 the
          title group had no floor at all, and a slot of actions that happened
          to fit beside it took the row. Chat read "(", Scripts "Scr…", and
          the subtitle went one word per line (the review of 2026-09-08). On a
          phone the actions take their own row unconditionally; from sm the
          floor decides, as before (T-0131). */}
      <div className="flex max-w-full flex-shrink-0 flex-wrap items-center gap-3 basis-full sm:basis-auto">
        <HelpLink />
        {actions}
      </div>
    </div>
  );
}
