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
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
