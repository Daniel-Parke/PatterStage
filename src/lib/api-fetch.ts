// ═══════════════════════════════════════════════════════════════
// Shared API fetch helper — single canonical implementation
// Eliminates the duplicated apiFetch() in kanban/page.tsx and teams/page.tsx.
// ═══════════════════════════════════════════════════════════════

/**
 * Fetch a JSON API endpoint with automatic error handling.
 *
 * - Sets Content-Type: application/json
 * - Parses JSON response
 * - Throws on non-2xx with the server's error message
 *
 * @example
 *   const data = await apiFetch("/api/teams");
 *   await apiFetch("/api/missions", { method: "POST", body: JSON.stringify({...}) });
 */
export async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });

  const json = await res.json().catch(() => ({ error: "Request failed" }));

  if (!res.ok) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }

  return json;
}
