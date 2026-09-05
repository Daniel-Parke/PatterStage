// ═══════════════════════════════════════════════════════════════
// HelpNav — the whole corpus, in the order it is meant to be read
//
// A server component with no state: the reading order is decided by
// helpNavOrder(), which already sorts the guides by the app's own rail rather
// than by their nav numbers, so the list on the left of Help and the list on
// the left of every other screen agree.
//
// The tour pages nest. There is one per rail destination and they would
// otherwise bury the three or four pages a new operator actually starts from,
// so they sit under their own sub-heading inside Start here while keeping the
// order helpNavOrder gave them — the same order prev/next walks.
// ═══════════════════════════════════════════════════════════════

import Link from "next/link";

import type { HelpNavSection, HelpPageMeta } from "@/lib/help/help-manifest";

/** The one slug prefix that gets its own sub-heading (contract 5.3). */
const TOUR_PREFIX = "start-here/tour/";

interface HelpNavProps {
  sections: HelpNavSection[];
  /** The slug being read, so exactly one link can say so. */
  current: string;
}

function NavLink({ page, current }: { page: HelpPageMeta; current: string }) {
  const active = page.slug === current;
  return (
    <li>
      <Link
        href={`/help/${page.slug}`}
        aria-current={active ? "page" : undefined}
        className={`block rounded px-2 py-1 text-sm transition-colors ${
          active
            ? "bg-dark-800 text-neon-cyan"
            : "text-ps-text-secondary hover:bg-dark-800 hover:text-white"
        }`}
      >
        {page.title}
      </Link>
    </li>
  );
}

export default function HelpNav({ sections, current }: HelpNavProps) {
  return (
    <nav aria-label="Help" className="w-full md:w-56 md:shrink-0">
      <ul className="space-y-5">
        {sections.map((section) => {
          const tour = section.pages.filter((p) => p.slug.startsWith(TOUR_PREFIX));
          const rest = section.pages.filter((p) => !p.slug.startsWith(TOUR_PREFIX));
          return (
            <li key={section.section}>
              <h2 className="px-2 text-xs font-mono uppercase tracking-wider text-ps-text-muted">
                {section.label}
              </h2>
              <ul className="mt-2 space-y-0.5">
                {rest.map((page) => (
                  <NavLink key={page.slug} page={page} current={current} />
                ))}
                {tour.length > 0 && (
                  <li className="pt-2">
                    <h3 className="px-2 text-xs font-mono uppercase tracking-wider text-ps-text-faint">
                      Tour
                    </h3>
                    <ul className="mt-1 space-y-0.5 border-l border-white/10 pl-2">
                      {tour.map((page) => (
                        <NavLink key={page.slug} page={page} current={current} />
                      ))}
                    </ul>
                  </li>
                )}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
