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
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactElement } from "react";

import HelpNav from "@/components/help/HelpNav";
import HelpSearch from "@/components/help/HelpSearch";
import AppPageShell from "@/components/layout/AppPageShell";
import HelpHeader from "@/components/help/HelpHeader";
import { Panel } from "@/components/dashboard/Panel";
import Card from "@/components/ui/Card";
import LinkButton from "@/components/ui/LinkButton";
import { recordEvent } from "@/lib/analytics/record-event";
import {
  helpIndexSlug,
  helpNavOrder,
  helpNeighbours,
  helpPageBySlug,
  isSafeHelpSlug,
  type HelpPageMeta,
} from "@/lib/help/help-manifest";
import { loadHelpFragment, loadHelpManifest, loadHelpSearchIndex } from "@/lib/help/help-source";

// The corpus is a build artefact that a dev rebuild can replace under a running
// server, and the loader memoises per process, so a statically rendered Help
// would serve whatever was on disk the first time anyone asked.
export const dynamic = "force-dynamic";

// The two columns and the gap between them. No width, no centring and no
// padding: the shell's container owns all three, so Help's left edge is the
// same one every other screen has.
const CONTENT_FRAME = "flex-1 w-full flex flex-col md:flex-row gap-6";

/**
 * What Help looks like before the docs have been generated.
 *
 * Inside the ordinary frame, deliberately: this is a state the operator can fix
 * in one command, not an error page. No notFound(), and no analytics event —
 * nothing was opened.
 */
function HelpNotBuilt(): ReactElement {
  return (
    <AppPageShell header={<HelpHeader subtitle="A guide for every screen, and the ideas behind it" />}>
      <div className={CONTENT_FRAME}>
        <Card className="flex-1 space-y-4">
          <h2 className="text-lead font-bold text-ps-text-primary">Help has not been built yet.</h2>
          <p className="text-body text-ps-text-secondary">
            The guides are generated from the repository&apos;s docs folder at build time, and the
            generated corpus is not kept in version control, so a fresh checkout has none of it
            until the first build.
          </p>
          <pre className="overflow-x-auto rounded-ps-sm bg-ps-surface-inset px-3 py-2 text-micro font-mono text-neon-cyan">
            {"npm run docs:build"}
          </pre>
        </Card>
      </div>
    </AppPageShell>
  );
}

/**
 * One generated page body, in this page's own DOM.
 *
 * Not an iframe. An iframe would need its own stylesheet, its own scroll, its
 * own focus order and its own answer to every link inside it, and the operator
 * would meet all four as "the docs feel bolted on". The fragment is body-only
 * HTML with no <h1> (the header owns that one), so it drops straight in.
 *
 * This is Help's ONLY dangerouslySetInnerHTML: the exemption is one line with
 * one reason beside it rather than a habit spread over four components.
 */
function HelpFragment({ html, slug }: { html: string | null; slug: string }): ReactElement {
  if (html === null) {
    // The manifest and the fragments are written by the same build, so a page
    // listed with no file on disk means a half-finished or interrupted one. An
    // empty article would read as a page with nothing to say; this says which
    // page, and what to run.
    return (
      <Panel role="alert" accent="orange" className="flex items-start gap-3 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-neon-orange" aria-hidden="true" />
        <p className="text-body text-ps-text-secondary">
          The guide <span className="font-mono">{slug}</span> is listed in the manifest but its page
          was not generated. Run <span className="font-mono">npm run docs:build</span> to rebuild the
          corpus.
        </p>
      </Panel>
    );
  }

  // design-lint-disable-next-line no-unsanitised-html -- the HTML is markdown-it output built by scripts/docs/build-site.mjs from docs/**.md at prebuild; it escapes at the boundary and never carries model output
  return <article className="ps-help-prose" data-testid="help-fragment" dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * The two ends of the reading path.
 *
 * The chain is the whole corpus flattened in helpNavOrder, so "next" at the end
 * of a tour stop is the next tour stop and not the next file in an alphabet.
 *
 * One end missing renders one link and nothing else. A disabled control at the
 * front of the corpus would be a thing to tab to that answers nothing, and the
 * pair reads perfectly well as a single link.
 */
function HelpPrevNext({ prev, next }: { prev: HelpPageMeta | null; next: HelpPageMeta | null }): ReactElement | null {
  if (!prev && !next) return null;
  return (
    <nav aria-label="Help pages" className="flex flex-wrap items-center gap-3">
      {prev && (
        <LinkButton href={`/help/${prev.slug}`} rel="prev" aria-label={`Previous: ${prev.title}`} icon={ChevronLeft}>
          <span className="truncate">{prev.title}</span>
        </LinkButton>
      )}
      {next && (
        <LinkButton href={`/help/${next.slug}`} rel="next" aria-label={`Next: ${next.title}`} className="ms-auto">
          <span className="truncate">{next.title}</span>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </LinkButton>
      )}
    </nav>
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
  const index = helpIndexSlug(manifest) || "";
  const wanted = slug || index;
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
    <AppPageShell
      header={
        /* An expression, not a literal: the walk in b3-titles-from-registry only
           reads title="..." string literals, and a page whose name is the guide's
           name is not a header contradicting its rail entry. */
        <HelpHeader title={page.title} subtitle={page.summary} back={wanted !== index} />
      }
    >
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
