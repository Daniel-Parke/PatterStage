// ═══════════════════════════════════════════════════════════════
// useSpend — the /api/spend data layer for the console.
//
// Read on the same 30s cadence as the other Insights queries, plus one
// mutation: saving the operator's budget. The save re-reads rather than
// patching a cache by hand, because the response carries the recomputed verdict
// and a locally guessed one could disagree with the server about whether a stop
// is engaged. That is not a disagreement worth having about money.
//
// The save goes through runWrite, so a refused budget is said in the server's
// words rather than returned to a caller that drops it; the refusal is still
// handed back for a panel that wants to show it beside the field.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { safeApiCall } from "@/lib/api/api-fetch";
import { runWrite } from "@/lib/api/api-write";
import { useApiResource } from "./useApiResource";
import type { SpendPolicyDraft } from "@/components/spend/SpendPanel";
import type { SpendSummary } from "@/lib/spend/spend-summary";

const SAVE_FAILED = "Failed to save the budget";

export function useSpend() {
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const r = useApiResource<SpendSummary>("/api/spend", {
    select: (p) => (p as { spend?: SpendSummary } | null)?.spend,
    errorMessage: "Failed to load provider spend",
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { refetch } = r;
  const saveBudget = useCallback(
    async (draft: SpendPolicyDraft): Promise<string | null> => {
      let refused: string | null = null;
      await runWrite({
        setBusy: setSaving,
        showToast,
        // safeApiCall serialises the body itself, so this is the object; a
        // refusal becomes the throw runWrite says and hands to onError.
        request: async () => {
          const res = await safeApiCall("/api/spend", { method: "PUT", body: draft });
          if (!res.ok) throw new Error(res.error ?? SAVE_FAILED);
          return res.data;
        },
        successMessage: "Budget saved",
        errorMessage: SAVE_FAILED,
        onSuccess: async () => {
          await refetch();
        },
        onError: (err) => {
          refused = err instanceof Error && err.message ? err.message : SAVE_FAILED;
        },
      });
      return refused;
    },
    [refetch, showToast],
  );

  return { spend: r.data ?? undefined, isLoading: r.isLoading, error: r.error, saving, saveBudget };
}
