// Render helper for components that read data through the TanStack Query
// hooks layer (useApiResource & friends). Wraps the tree in a fresh
// QueryClientProvider with retries disabled so a single failed fetch in a
// test surfaces immediately instead of being retried. Returns the standard
// RenderResult, so `rerender` re-applies the same provider/client.

import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function renderWithQuery(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(ui, { wrapper: Wrapper, ...options });
}
