// ── SkillsCatalogEmpty — what the Skills Manager shows with no catalog.
// Extracted verbatim from app/operations/skills/page.tsx, import
// affordance included. The import call itself stays on the page.

"use client";

import { FileText } from "lucide-react";
import Button from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/LoadingSpinner";

export default function SkillsCatalogEmpty({
  importing,
  onImport,
}: {
  importing: boolean;
  onImport: () => void;
}) {
  return (
    <EmptyState
      icon={FileText}
      title="No skills in catalog"
      // design-lint-disable-next-line hermes-outside-adapter -- empty-state copy for an import button. It tells the operator where the skills are being imported FROM, which is the one thing they need before pressing a button that writes to the catalog.
      description="Import the global skills tree from ~/.hermes/skills into PatterStage SQLite, then push to sync disk."
      action={
        <Button
          variant="primary"
          color="green"
          onClick={onImport}
          disabled={importing}
        >
          {importing ? "Importing…" : "Import skills from Hermes"}
        </Button>
      }
    />
  );
}
