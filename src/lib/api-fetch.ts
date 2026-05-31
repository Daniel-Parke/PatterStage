// ═══════════════════════════════════════════════════════════════
// Shared API fetch helper — single canonical implementation
// ═══════════════════════════════════════════════════════════════

/**
 * Fetch a JSON API endpoint with automatic error handling.
 *
 * - Sets Content-Type: application/json
 * - Parses JSON response
 * - Throws on non-2xx with the server's error message
 *
 * @example
 *   const { data } = await apiFetch("/api/monitor");
 *   await apiFetch("/api/missions", { method: "POST", body: JSON.stringify({...}) });
 */
// ── Error helpers ────────────────────────────────────────────────

/** Coerce an unknown value to an Error (preserving Error instances). */
export function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic JSON fetch returns arbitrary shapes
export async function apiFetch<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });

  const json = await res.json().catch(() => {
    throw new Error(`API returned invalid JSON (HTTP ${res.status})`);
  });

  if (!res.ok) {
    const base = typeof json.error === "string" ? json.error : `HTTP ${res.status}`;
    const push =
      typeof json.cronPushError === "string" && json.cronPushError.trim()
        ? json.cronPushError
        : null;
    throw new Error(push ? `${base}: ${push}` : base);
  }

  return json;
}

/**
 * Safe API call wrapper — catches errors and returns { ok, error, data }.
 * Use in hooks/event handlers where you need to handle errors gracefully
 * without try/catch at every call site.
 *
 * @example
 *   const { ok, error } = await safeApiCall("/api/cron", { method: "POST", body: { action: "sync" } });
 *   if (!ok) showToast(error!, "error");
 */
export async function safeApiCall<T = unknown>(
  path: string,
  options?: Omit<RequestInit, "body"> & { body?: unknown }
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const data = await apiFetch(path, {
      ...options,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    return { ok: true, data: data as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Request failed" };
  }
}
