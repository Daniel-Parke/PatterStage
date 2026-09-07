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
        <div className="max-w-ps-reading space-y-4 rounded-ps-md border border-ps-edge-hairline bg-ps-surface-panel px-4 py-4">
          <h2 className="text-lead font-bold text-ps-text-primary">There is no such guide.</h2>
          <p className="text-body text-ps-text-secondary">
            The address does not name a page in this build of the corpus. A guide that has been
            renamed keeps its content under a new slug, so the contents list is the fastest way
            back to it.
          </p>
          <Link
            href="/help"
            className="inline-flex items-center rounded-ps-md border border-neon-cyan/40 px-3 py-2 text-body text-neon-cyan transition-colors hover:bg-ps-surface-inset"
          >
            Back to the contents
          </Link>
        </div>
      </div>
    </AppPageShell>
  );
}
