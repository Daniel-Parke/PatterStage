// ═══════════════════════════════════════════════════════════════
// useOperatorPrefs — the console's own settings, as a query
//
// GET /api/prefs answers the whole allow-listed map and so does PUT, so a
// write is a read: the mutation invalidates the query and the next render sees
// the server's map rather than a guess about it. That matters for the quest
// preferences in particular, because `quests.skipped` is an ARRAY and a client
// that assumed its own copy was current would write the wrong one back.
//
// The Sidebar keeps its own hand-rolled read of `sidebar.collapsed`. That is
// deliberate for now: the rail reads once at mount, before any provider is
// guaranteed, and folding it onto this hook is a change to the shell rather
// than to the quests page.
//
// A failed write is reported, never swallowed. Under PS_READ_ONLY the PUT is
// refused by design, and an operator who clicks Skip and sees nothing happen
// has been told a lie by silence.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { safeApiCall } from "@/lib/api-fetch";

import { useApiResource } from "./useApiResource";

/** The one query key the prefs map lives under. */
const OPERATOR_PREFS_QUERY_KEY = ["operator-prefs"] as const;

export interface UseOperatorPrefsResult {
  /** Every stored preference, keyed as the allow-list names it. */
  prefs: Record<string, unknown>;
  isLoading: boolean;
  /** The read's failure, when there was one. */
  error: string | null;
  refetch: () => void;
  /** Write one allow-listed key. The map is re-read from the server after. */
  setPref: (key: string, value: unknown) => void;
  saving: boolean;
  /** The last write's failure, until the next write clears it. */
  saveError: string | null;
}

export function useOperatorPrefs(): UseOperatorPrefsResult {
  const queryClient = useQueryClient();
  const read = useApiResource<Record<string, unknown>>(OPERATOR_PREFS_QUERY_KEY, "/api/prefs", {
    select: (p) => (p as { prefs?: Record<string, unknown> } | undefined)?.prefs,
    fallback: {},
    errorMessage: "Failed to read your preferences",
    staleTime: 30_000,
  });

  const write = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const res = await safeApiCall("/api/prefs", { method: "PUT", body: { key, value } });
      if (!res.ok) throw new Error(res.error ?? "Failed to save the preference");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: OPERATOR_PREFS_QUERY_KEY });
    },
  });

  const { mutate } = write;
  const setPref = useCallback((key: string, value: unknown) => mutate({ key, value }), [mutate]);

  return {
    prefs: read.data ?? {},
    isLoading: read.isLoading,
    error: read.error,
    refetch: () => void read.refetch(),
    setPref,
    saving: write.isPending,
    saveError: write.error ? write.error.message : null,
  };
}
