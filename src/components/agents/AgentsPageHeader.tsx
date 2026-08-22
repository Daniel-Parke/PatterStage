// ── AgentsPageHeader — title, profile count and the New Profile button.
// Extracted verbatim from app/operations/agents/page.tsx.

"use client";

import { Plus, Users } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

export default function AgentsPageHeader({
  profileCount,
  onNewProfile,
}: {
  profileCount: number;
  onNewProfile: () => void;
}) {
  return (
    <PageHeader
      icon={Users}
      title="Agent Profiles"
      subtitle={`${profileCount} profiles configured`}
      color="purple"
      actions={
        <Button
          variant="primary"
          color="purple"
          icon={Plus}
          onClick={onNewProfile}
        >
          New Profile
        </Button>
      }
    />
  );
}
