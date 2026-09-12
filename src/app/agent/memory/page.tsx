// ═══════════════════════════════════════════════════════════════
// Memory Manager — Hindsight knowledge-graph memory browser
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback, useState } from "react";
import { Brain } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import AppPageShell from "@/components/layout/AppPageShell";
import HindsightBrowser from "@/components/memory/HindsightBrowser";
import MemoryProviderSettings from "@/components/memory/MemoryProviderSettings";
import type { HealthState } from "@/components/memory/hindsight/types";

export default function MemoryPage() {
  // The store's health is read once, by the browser, and said once, by the
  // card: two components used to warn about the same fact on a first visit
  // (T-0101). The token is how the card tells the list to try again.
  const [health, setHealth] = useState<HealthState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  return (
    <AppPageShell
      header={
        <PageHeader
          icon={Brain}
          subtitle="Knowledge graph memory with semantic search"
          color="pink"
        />
      }
    >
      <div className="space-y-6">
        <MemoryProviderSettings storeHealth={health} onReconnected={reload} onRetry={reload} />
        <HindsightBrowser onHealthChange={setHealth} reloadToken={reloadToken} />
      </div>
    </AppPageShell>
  );
}