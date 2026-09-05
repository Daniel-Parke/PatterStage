// ═══════════════════════════════════════════════════════════════
// useSpend — the /api/spend data layer for the console.
//
// Read on the same 30s cadence as the other Insights queries, plus one
// mutation: saving the operator's budget. The save re-reads rather than
// patching a cache by hand, because the response carries the recomputed verdict
// and a locally guessed one could disagree with the server about whether a stop
// is engaged. That is not a disagreement worth having about money.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback, useState } from "react";

import { safeApiCall } from "@/lib/api-fetch";
import { useApiResource } from "./useApiResource";
import type { SpendPolicyDraft } from "@/components/spend/SpendPanel";
import type { SpendSummary } from "@/lib/spend/spend-summary";

export function useSpend() {
  const [saving, setSaving] = useState(false);
  const r = useApiResource<SpendSummary>(["spend"], "/api/spend", {
    select: (p) => (p as { spend?: SpendSummary } | null)?.spend,
    errorMessage: "Failed to load provider spend",
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { refetch } = r;
  const saveBudget = useCallback(
    async (draft: SpendPolicyDraft): Promise<string | null> => {
      setSaving(true);
      try {
        // safeApiCall serialises the body itself, so this is the object.
        const res = await safeApiCall("/api/spend", { method: "PUT", body: draft });
        if (!res.ok) return res.error ?? "Failed to save the budget";
        await refetch();
        return null;
      } finally {
        setSaving(false);
      }
    },
    [refetch],
  );

  return { spend: r.data ?? undefined, isLoading: r.isLoading, error: r.error, saving, saveBudget };
}
