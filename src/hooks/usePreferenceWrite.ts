"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { safeApiCall } from "@/lib/api/api-fetch";
import { apiQueryKey } from "./useApiResource";

/** Write one preference without subscribing to or fetching the preference map. */
export function usePreferenceWrite() {
  const client = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const result = await safeApiCall("/api/prefs", { method: "PUT", body: { key, value } });
      if (!result.ok) throw new Error(result.error ?? "Failed to save the preference");
    },
    onSuccess: async () => {
      const query = { queryKey: apiQueryKey("/api/prefs"), exact: true };
      await client.cancelQueries(query);
      void client.invalidateQueries(query);
    },
  });
}
