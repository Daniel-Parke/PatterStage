// ═══════════════════════════════════════════════════════════════
// The Help-shaped 404
//
// A slug that no page in the manifest answers for lands here rather than on the
// app's global not-found, so the operator keeps the frame, the rail and the way
// back into the corpus instead of being dropped out of the section entirely.
// This is what an old bookmark meets after a page is renamed.
// ═══════════════════════════════════════════════════════════════

import AppPageShell from "@/components/layout/AppPageShell";
import HelpHeader from "@/components/help/HelpHeader";
import Card from "@/components/ui/Card";
import LinkButton from "@/components/ui/LinkButton";

export default function HelpNotFound() {
  return (
    <AppPageShell>
      <HelpHeader subtitle="A guide for every screen, and the ideas behind it" />
      <div className="flex-1 w-full max-w-6xl mx-auto px-6 py-6">
        <Card className="max-w-ps-reading space-y-4">
          <h2 className="text-lead font-bold text-ps-text-primary">There is no such guide.</h2>
          <p className="text-body text-ps-text-secondary">
            The address does not name a page in this build of the corpus. A guide that has been
            renamed keeps its content under a new slug, so the contents list is the fastest way
            back to it.
          </p>
          <LinkButton href="/help" variant="secondary" color="cyan">
            Back to the contents
          </LinkButton>
        </Card>
      </div>
    </AppPageShell>
  );
}
