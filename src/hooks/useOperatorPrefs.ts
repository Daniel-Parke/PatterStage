// ═══════════════════════════════════════════════════════════════
// useOperatorPrefs — the console's own settings, as a query
//
// GET /api/prefs answers the whole allow-listed map and so does PUT, so a
// write is a read: the mutation invalidates the query and the next render sees
// the server's map rather than a guess about it. That matters for the quest
// preferences in particular, because `quests.skipped` is an ARRAY and a client
// that assumed its own copy was current would write the wrong one back.
//
// The Sidebar reads `sidebar.collapsed` once, server-side, before any provider
// is mounted, and writes it through a mutation that invalidates this hook's
// key (C6); it does not read through this hook, because the rail paints before
// the query layer exists.
//
// A failed write is reported, never swallowed. Under PS_READ_ONLY the PUT is
// refused by design, and an operator who clicks Skip and sees nothing happen
// has been told a lie by silence.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback } from "react";
import { usePreferenceWrite } from "./usePreferenceWrite";
import { useApiResource } from "./useApiResource";

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
  const read = useApiResource<Record<string, unknown>>("/api/prefs", {
    select: (p) => (p as { prefs?: Record<string, unknown> } | undefined)?.prefs,
    fallback: {},
    errorMessage: "Failed to read your preferences",
    staleTime: 30_000,
  });

  const write = usePreferenceWrite();

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
