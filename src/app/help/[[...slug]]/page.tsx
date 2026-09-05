// ═══════════════════════════════════════════════════════════════
// /help/[[...slug]] — the guides, rendered in the app that they document
//
// The first server page in the console; every other page.tsx is "use client".
// It has to be, because the corpus is read off disk: public/help/ is generated
// from docs/**.md at prebuild, and the alternative is a fetch that would be
// answering to Next's static-asset precedence rather than to us.
//
// The optional catch-all serves /help and /help/<slug> from one file, which is
// why src/app/help/page.tsx is gone: a sibling page.tsx beside [[...slug]] is a
// route conflict and the build refuses it.
//
// Nothing here throws on a missing corpus. A fresh clone has no public/help/
// until the first build, and the rail's Help entry has to lead somewhere that
// explains itself rather than to a stack trace or a 404.
// ═══════════════════════════════════════════════════════════════

import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import HelpFragment from "@/components/help/HelpFragment";
import HelpNav from "@/components/help/HelpNav";
import HelpPrevNext from "@/components/help/HelpPrevNext";
import HelpSearch from "@/components/help/HelpSearch";
import AppPageShell from "@/components/layout/AppPageShell";
import HelpHeader from "@/components/help/HelpHeader";
import { recordEvent } from "@/lib/analytics/record-event";
import {
  helpIndexSlug,
  helpNavOrder,
  helpNeighbours,
  helpPageBySlug,
  isSafeHelpSlug,
} from "@/lib/help/help-manifest";
import { loadHelpFragment, loadHelpManifest, loadHelpSearchIndex } from "@/lib/help/help-source";

// The corpus is a build artefact that a dev rebuild can replace under a running
// server, and the loader memoises per process, so a statically rendered Help
// would serve whatever was on disk the first time anyone asked.
export const dynamic = "force-dynamic";

const CONTENT_FRAME = "flex-1 w-full flex flex-col md:flex-row gap-6 px-6 py-6 max-w-6xl mx-auto";

/**
 * What Help looks like before the docs have been generated.
 *
 * Inside the ordinary frame, deliberately: this is a state the operator can fix
 * in one command, not an error page. No notFound(), and no analytics event —
 * nothing was opened.
 */
function HelpNotBuilt(): ReactElement {
  return (
    <AppPageShell>
      <HelpHeader subtitle="A guide for every screen, and the ideas behind it" />
      <div className={CONTENT_FRAME}>
        <div className="min-w-0 flex-1 space-y-4 rounded-lg border border-white/10 bg-dark-900/50 px-4 py-4">
          <h2 className="text-base font-bold text-ps-text-primary">Help has not been built yet.</h2>
          <p className="text-sm text-ps-text-secondary">
            The guides are generated from the repository&apos;s docs folder at build time, and the
            generated corpus is not kept in version control, so a fresh checkout has none of it
            until the first build.
          </p>
          <pre className="overflow-x-auto rounded bg-dark-800 px-3 py-2 text-xs font-mono text-neon-cyan">
            {"npm run docs:build"}
          </pre>
        </div>
      </div>
    </AppPageShell>
  );
}

export default async function HelpPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<ReactElement> {
  const slug = (await params).slug?.join("/") ?? "";
  const manifest = loadHelpManifest();

  // Before any slug is judged: with no corpus there is nothing to judge it
  // against, and 404ing a page that may well exist would be a lie.
  if (manifest.pages.length === 0) return <HelpNotBuilt />;

  // /help itself is the first page of the reading order, whatever B15 numbered
  // that to be. Nothing here holds a slug as a literal.
  const wanted = slug || helpIndexSlug(manifest) || "";
  // The guard is redundant here and kept anyway: parseHelpManifest already
  // dropped every unsafe slug, so an unsafe `wanted` finds no page and 404s
  // either way, and a sweep reports this as an equivalent mutant. What it buys
  // is that the refusal does not depend on the parser two modules away staying
  // strict, which is the kind of coupling nobody notices loosening.
  const page = isSafeHelpSlug(wanted) ? helpPageBySlug(manifest, wanted) : null;
  if (!page) notFound();

  // After the page is known to exist, so a 404 and a traversal attempt leave no
  // trace in the ledger B17's quests read.
  recordEvent("help.opened", { entityType: "help", entityId: wanted });

  const { prev, next } = helpNeighbours(manifest, wanted);
  return (
    <AppPageShell>
      {/* An expression, not a literal: the walk in b3-titles-from-registry only
          reads title="..." string literals, and a page whose name is the guide's
          name is not a header contradicting its rail entry. */}
      <HelpHeader title={page.title} subtitle={page.summary} />
      <div className={CONTENT_FRAME}>
        <HelpNav sections={helpNavOrder(manifest)} current={wanted} />
        <div className="min-w-0 flex-1 space-y-6">
          <HelpSearch entries={loadHelpSearchIndex()} />
          <HelpFragment html={loadHelpFragment(wanted)} slug={wanted} />
          <HelpPrevNext prev={prev} next={next} />
        </div>
      </div>
    </AppPageShell>
  );
}
