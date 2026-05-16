// ═══════════════════════════════════════════════════════════════
// fetch-api — Shared API fetch helper for client components
// ═══════════════════════════════════════════════════════════════

/**
 * Fetch JSON from a Control Hub API endpoint.
 * Adds Content-Type header and throws on non-ok responses.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}
