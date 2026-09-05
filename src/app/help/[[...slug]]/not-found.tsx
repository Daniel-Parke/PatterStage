// ═══════════════════════════════════════════════════════════════
// The Help-shaped 404
//
// A slug that no page in the manifest answers for lands here rather than on the
// app's global not-found, so the operator keeps the frame, the rail and the way
// back into the corpus instead of being dropped out of the section entirely.
// This is what an old bookmark meets after a page is renamed.
// ═══════════════════════════════════════════════════════════════

import Link from "next/link";

import AppPageShell from "@/components/layout/AppPageShell";
import HelpHeader from "@/components/help/HelpHeader";

export default function HelpNotFound() {
  return (
    <AppPageShell>
      <HelpHeader subtitle="A guide for every screen, and the ideas behind it" />
      <div className="flex-1 w-full max-w-6xl mx-auto px-6 py-6">
        <div className="max-w-ps-reading space-y-4 rounded-lg border border-white/10 bg-dark-900/50 px-4 py-4">
          <h2 className="text-base font-bold text-ps-text-primary">There is no such guide.</h2>
          <p className="text-sm text-ps-text-secondary">
            The address does not name a page in this build of the corpus. A guide that has been
            renamed keeps its content under a new slug, so the contents list is the fastest way
            back to it.
          </p>
          <Link
            href="/help"
            className="inline-flex items-center rounded-lg border border-neon-cyan/40 px-3 py-2 text-sm text-neon-cyan transition-colors hover:bg-dark-800"
          >
            Back to the contents
          </Link>
        </div>
      </div>
    </AppPageShell>
  );
}
