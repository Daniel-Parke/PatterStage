// ═══════════════════════════════════════════════════════════════
// HelpPrevNext — the two ends of the reading path
//
// The chain is the whole corpus flattened in helpNavOrder, so "next" at the end
// of a tour stop is the next tour stop and not the next file in an alphabet.
//
// One end missing renders one link and nothing else. A disabled control at the
// front of the corpus would be a thing to tab to that answers nothing, and the
// pair reads perfectly well as a single link.
// ═══════════════════════════════════════════════════════════════

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { HelpPageMeta } from "@/lib/help/help-manifest";

interface HelpPrevNextProps {
  prev: HelpPageMeta | null;
  next: HelpPageMeta | null;
}

const linkClasses =
  "flex items-center gap-2 rounded-ps-md border border-ps-edge bg-ps-surface-panel px-3 py-2 text-body text-ps-text-secondary transition-colors hover:border-neon-cyan/40 hover:text-ps-text-primary";

export default function HelpPrevNext({ prev, next }: HelpPrevNextProps) {
  if (!prev && !next) return null;
  return (
    <nav aria-label="Help pages" className="flex flex-wrap items-center gap-3">
      {prev && (
        <Link href={`/help/${prev.slug}`} rel="prev" aria-label={`Previous: ${prev.title}`} className={linkClasses}>
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{prev.title}</span>
        </Link>
      )}
      {next && (
        <Link
          href={`/help/${next.slug}`}
          rel="next"
          aria-label={`Next: ${next.title}`}
          className={`${linkClasses} ms-auto`}
        >
          <span className="truncate">{next.title}</span>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
