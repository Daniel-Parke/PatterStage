// ═══════════════════════════════════════════════════════════════
// QueryProvider — client-side TanStack Query data layer
//
// Wraps the app so hooks (useSchedules, useRunProgress, …) can use
// useQuery/useMutation with shared caching + dedup, replacing ad-hoc
// fetch-in-useEffect polling. `safeApiCall` remains the underlying fetcher.
// ═══════════════════════════════════════════════════════════════

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export default function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            // Catch up when the tab comes back. useInterval already does this
            // deliberately and its comment claims it was made to MATCH the
            // query layer; the query layer had focus-refetch off, so the two
            // quietly disagreed in the opposite direction. A backgrounded tab
            // resumed showing data up to a full poll period stale with no way
            // to know (T-0053). staleTime keeps it cheap: a refocus inside ten
            // seconds still serves the cache.
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
