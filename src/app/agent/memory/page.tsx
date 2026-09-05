// ═══════════════════════════════════════════════════════════════
// Memory Manager — Hindsight knowledge-graph memory browser
// ═══════════════════════════════════════════════════════════════

"use client";

import { Brain } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import AppPageShell from "@/components/layout/AppPageShell";
import HindsightBrowser from "@/components/memory/HindsightBrowser";
import MemoryProviderSettings from "@/components/memory/MemoryProviderSettings";

export default function MemoryPage() {
  return (
    <AppPageShell>
      <PageHeader
        icon={Brain}
        subtitle="Knowledge graph memory with semantic search"
        color="pink"
      />
      <div className="space-y-6 px-6 py-6">
        <MemoryProviderSettings />
        <HindsightBrowser />
      </div>
    </AppPageShell>
  );
}