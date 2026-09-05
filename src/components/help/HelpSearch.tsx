// ═══════════════════════════════════════════════════════════════
// HelpSearch — find a page, or a heading inside one
//
// The index arrives as a prop from the server, and there is no fetch anywhere
// in this file. That is what keeps Help working on an instance with no network
// beyond the operator's own browser, and it is why the corpus is read from disk
// rather than over HTTP: public/ files win over an app route, so /help/search.json
// would be the file rather than the page and a fetch would be answering to
// Next's static-asset precedence rather than to us.
//
// The filter is a substring match over three fields and nothing cleverer. A
// corpus of a few hundred rows does not need an index, and a ranking nobody can
// explain is worse than an ordering the generator already chose.
// ═══════════════════════════════════════════════════════════════

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { HelpSearchEntry } from "@/lib/help/help-manifest";
import { inputFieldClasses } from "@/lib/theme";

/** Enough to find the page; more than this is a list nobody reads. */
const MAX_RESULTS = 20;

function href(entry: HelpSearchEntry): string {
  return entry.anchor ? `/help/${entry.slug}#${entry.anchor}` : `/help/${entry.slug}`;
}

export default function HelpSearch({ entries }: { entries: HelpSearchEntry[] }) {
  const [query, setQuery] = useState("");
  const term = query.trim();
  const needle = term.toLowerCase();

  const results = useMemo(() => {
    if (!needle) return [];
    return entries
      .filter(
        (e) =>
          e.title.toLowerCase().includes(needle) ||
          (e.heading ?? "").toLowerCase().includes(needle) ||
          e.text.toLowerCase().includes(needle),
      )
      .slice(0, MAX_RESULTS);
  }, [entries, needle]);

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search the help"
        // The placeholder is deliberately NOT the label repeated: the
        // form-control gate refuses a name that is just the placeholder pasted
        // in, because a placeholder disappears the moment the field has content
        // (T-0096, D118). It carries an example instead.
        placeholder="Try 'mission' or 'backup'"
        className={inputFieldClasses("cyan")}
      />

      {/* The count and the empty answer share one live region, so a screen
          reader hears the result of a keystroke rather than nothing at all. */}
      <p role="status" className="text-xs font-mono text-ps-text-muted">
        {term === ""
          ? ""
          : results.length === 0
            ? `Nothing matches ${term}.`
            : `${results.length} match${results.length === 1 ? "" : "es"}`}
      </p>

      {results.length > 0 && (
        <ul className="divide-y divide-white/10 rounded-lg border border-white/10 bg-dark-900/50">
          {results.map((entry) => (
            <li key={`${entry.slug}#${entry.anchor ?? ""}`}>
              <Link
                href={href(entry)}
                className="block px-3 py-2 transition-colors hover:bg-dark-800"
              >
                <span className="block text-sm text-ps-text-primary">
                  {entry.heading ?? entry.title}
                </span>
                <span className="block text-xs font-mono text-ps-text-muted">{entry.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
