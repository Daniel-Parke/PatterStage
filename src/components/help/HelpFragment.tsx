// ═══════════════════════════════════════════════════════════════
// HelpFragment — one generated page body, in this page's own DOM
//
// Not an iframe. An iframe would need its own stylesheet, its own scroll, its
// own focus order and its own answer to every link inside it, and the operator
// would meet all four as "the docs feel bolted on". The fragment is body-only
// HTML with no <h1> (the PageHeader owns that one), so it drops straight in.
//
// This is the batch's ONLY dangerouslySetInnerHTML, which is the point of
// keeping it in a file this small: the exemption is one line with one reason
// beside it rather than a habit spread over four components.
// ═══════════════════════════════════════════════════════════════

import { AlertTriangle } from "lucide-react";

interface HelpFragmentProps {
  /** The fragment body, or null when the file the manifest names is absent. */
  html: string | null;
  slug: string;
}

export default function HelpFragment({ html, slug }: HelpFragmentProps) {
  if (html === null) {
    // The manifest and the fragments are written by the same build, so a page
    // listed with no file on disk means a half-finished or interrupted one. An
    // empty article would read as a page with nothing to say; this says which
    // page, and what to run.
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-lg border border-semantic-warning/40 bg-dark-900/50 px-4 py-3"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-semantic-warning" aria-hidden="true" />
        <p className="text-sm text-ps-text-secondary">
          The guide <span className="font-mono">{slug}</span> is listed in the manifest but its page
          was not generated. Run <span className="font-mono">npm run docs:build</span> to rebuild the
          corpus.
        </p>
      </div>
    );
  }

  // design-lint-disable-next-line no-unsanitised-html -- the HTML is markdown-it output built by scripts/docs/build-site.mjs from docs/**.md at prebuild; it escapes at the boundary and never carries model output
  return <article className="ps-help-prose" data-testid="help-fragment" dangerouslySetInnerHTML={{ __html: html }} />;
}
