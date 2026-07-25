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

/**
 * Coerce an unknown caught value to a user-friendly error message,
 * falling back to `fallback` when the error is empty/unknown.
 *
 * This is the canonical replacement for the long-standing pattern
 *   err instanceof Error ? err.message : <fallback>
 * that appears 20+ times across operations pages, hooks, and
 * `safeApiCall` itself. It composes `toError()` and centralises the
 * `|| fallback` discipline so every catch block is guaranteed to
 * produce a non-empty string.
 *
 * @example
 *   } catch (err) {
 *     showToast(messageFromError(err, "Failed to load"), "error");
 *   }
 */
export function messageFromError(e: unknown, fallback: string): string {
  return toError(e).message || fallback;
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
    throw new ApiError(push ? `${base}: ${push}` : base, res.status, json);
  }

  return json;
}

/**
 * A non-2xx response, carrying the status and the parsed body.
 *
 * Callers used to get only a message string, which is enough to show a toast but
 * not enough to *act* on a status. A 409 that a user can resolve by confirming
 * is not the same as a 500, and telling them apart required parsing the prose.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Safe API call wrapper — catches errors and returns { ok, error, data }.
 * Use in hooks/event handlers where you need to handle errors gracefully
 * without try/catch at every call site.
 *
 * @example
 *   const { ok, error } = await safeApiCall("/api/schedules", { method: "POST", body: { missionId, schedule } });
 *   if (!ok) showToast(error!, "error");
 */
/** Return shape of `safeApiCall` — used by `runMutation` consumers to read fields beyond ok/error. */
export type SafeApiCallResult<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: string;
  /** HTTP status when the call reached the server. Absent on a network failure. */
  status?: number;
  /** Parsed error body, so a caller can read fields the message does not carry. */
  body?: unknown;
};

export async function safeApiCall<T = unknown>(
  path: string,
  options?: Omit<RequestInit, "body"> & { body?: unknown }
): Promise<SafeApiCallResult<T>> {
  try {
    const data = await apiFetch(path, {
      ...options,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    return { ok: true, data: data as T };
  } catch (e) {
    if (e instanceof ApiError) {
      // messageFromError, not e.message: a server that answers `{ error: "" }`
      // must still produce a non-empty toast.
      return {
        ok: false,
        error: messageFromError(e, "Request failed"),
        status: e.status,
        body: e.body,
      };
    }
    return { ok: false, error: messageFromError(e, "Request failed") };
  }
}

/**
 * Safe API call that unwraps the `{ data: T }` envelope in one step.
 *
 * Every PatterStage API route returns `{ data: T }` (or `{ data: T, error?: string }`).
 * `safeApiCall<T>` returns the raw envelope as `{ ok, data: T, error? }` so the
 * caller is responsible for picking the right envelope field. When the
 * caller only needs the inner `data` field (the most common case for
 * `Promise.all([...])` batched fetches and `if (data) setData(...)` updates),
 * the manual form is:
 *
 * ```ts
 * const { data } = await safeApiCall<{ data?: MonitorData }>("/api/monitor");
 * if (data?.data) setData({ monitor: data.data });
 * ```
 *
 * `safeApiCallData` collapses that to:
 *
 * ```ts
 * const monitor = await safeApiCallData<MonitorData>("/api/monitor");
 * if (monitor) setData({ monitor });
 * ```
 *
 * Byte-equivalence:
 * - `safeApiCallData<T>(path, init)` is `T | null`, identical to
 *   `((await safeApiCall<{ data?: T }>(path, init)).data?.data ?? null)`.
 *   On error (`ok: false`) `safeApiCall.data` is `undefined`, so the
 *   optional chain short-circuits to `undefined` and the `?? null` returns
 *   `null`. The helper produces the same `null` on error.
 * - On success-but-no-data (e.g. a 200 response with `{ data: null }`),
 *   the inner `data` is `undefined` and the helper returns `null` — same
 *   as the inline form.
 * - The `T` type is the inner payload, not the envelope — call sites
 *   that used `safeApiCall<{ data: SomeType }>` to express "the API
 *   returns `{ data: SomeType }`" pass `SomeType` directly here. The
 *   helper infers the envelope shape internally.
 *
 * Use `safeApiCall` when you need `ok`/`error` (e.g. mutation results with
 * toasts), or when the response shape isn't a `{ data: T }` envelope.
 * Use `safeApiCallData` for read-only fetches of a `{ data: T }` envelope.
 *
 * @example
 *   // Single fetch:
 *   const monitor = await safeApiCallData<MonitorData>("/api/monitor");
 *   if (monitor) setData({ monitor });
 *
 *   // Batched:
 *   const [status, config] = await Promise.all([
 *     safeApiCallData<SystemStatus>("/api/status", { signal }),
 *     safeApiCallData<Record<string, unknown>>("/api/config", { signal }),
 *   ]);
 */
export async function safeApiCallData<T = unknown>(
  path: string,
  options?: Omit<RequestInit, "body"> & { body?: unknown }
): Promise<T | null> {
  const { ok, data } = await safeApiCall<{ data?: T }>(path, options);
  if (!ok) return null;
  return (data?.data ?? null) as T | null;
}

/**
 * Type signature matching the destructured `showToast` from
 * `@/components/ui/Toast`'s `useToast()`. We don't import the type
 * here to avoid a circular dep (ui/Toast is a client component, this
 * file is shared with server code).
 */
type ShowToastFn = (message: string, type?: "success" | "error" | "info") => void;

/**
 * Show a toast for a caught error in a single call. Composes
 * `messageFromError()` so every `showToast(messageFromError(err, ...), "error")`
 * site becomes `toastError(showToast, err, ...)` — one fewer intermediate
 * variable and one less line in the common catch block.
 *
 * Byte-equivalent to the inline form: same `messageFromError` semantics
 * (falls back to `fallback` when the error has no message), same
 * `"error"` toast type, same call to `showToast`.
 *
 * @example
 *   } catch (err) {
 *     toastError(showToast, err, "Delete failed");
 *   }
 */
export function toastError(
  showToast: ShowToastFn,
  err: unknown,
  fallback: string,
): void {
  showToast(messageFromError(err, fallback), "error");
}

/**
 * Type signature matching the destructured `setError` from a
 * `useState<string | null>`-style call. We don't import the type
 * here to avoid React coupling in this module. The setter takes a
 * string-or-null; we never pass null through this helper, only the
 * resolved message.
 */
type SetErrorFn = (value: string | null) => void;

/**
 * Set a `useState<string | null>` error from a caught value in a
 * single call. Composes `messageFromError()` so every
 *   setError(messageFromError(err, "..."))
 * catch block becomes `setErrorFromCaught(setError, err, "...")` —
 * one fewer intermediate variable and the same byte-equivalent
 * semantics as the inline form.
 *
 * This is the `setError` sibling of `toastError` — same composition
 * rules (toError() + `|| fallback` discipline), different consumer.
 * Use `toastError` for showToast-based error reporting and
 * `setErrorFromCaught` for useState-based error reporting.
 *
 * **Returns the resolved message** so callers that need the same
 * string for both state AND a side-effect (toast, audit, log) can
 * reuse it. The single-resolve guarantee eliminates the
 * `messageFromError(err, X)` + `setError(...)` + `showToast(...)`
 * 3-call triplet at dual-dispatch sites like `loadCategories` in
 * `useMissionsPage.ts`, which is exactly the site that motivated
 * the return-value enhancement (session 178, List 2 carryover).
 *
 * @example
 *   } catch (err) {
 *     setErrorFromCaught(setError, err, "Failed to load");
 *   }
 *
 * @example Dual-dispatch (state + toast):
 *   } catch (err) {
 *     const msg = setErrorFromCaught(setError, err, "Failed to load");
 *     showToast(msg, "error");
 *   }
 */
export function setErrorFromCaught(
  setError: SetErrorFn,
  err: unknown,
  fallback: string,
): string {
  const msg = messageFromError(err, fallback);
  setError(msg);
  return msg;
}
