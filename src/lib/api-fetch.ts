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
 * Walk an error's `cause` chain, outermost first, stopping at the first
 * link that is not an Error.
 *
 * Node's fetch is the reason this exists. undici throws
 * `TypeError: fetch failed` and puts the only sentence worth reading one
 * level down: `Error: connect ECONNREFUSED 127.0.0.1:8642`. Anything that
 * reads `.message` alone therefore reports the wrapper and discards the
 * fact, which is how a chat turn against a stopped gateway came back as
 * "fetch failed" and, further downstream, as the bare string "run failed".
 *
 * Two deliberate properties, both load-bearing:
 *
 *   * A non-Error input yields an EMPTY chain, not a wrapped one. The
 *     sibling reader `isHindsightConnectionError` is pinned on
 *     `("fetch failed")` (a bare string) being FALSE, because a string is
 *     not evidence of a transport failure. A walker that coerced its input
 *     would quietly flip that. Callers that want String() coercion compose
 *     with `toError()` first, which is exactly what `messageFromError` does.
 *   * The depth cap makes a cyclic `cause` terminate rather than hang.
 *     Self-referential causes are rare but real, and a diagnostic helper
 *     that can hang is worse than no diagnostic at all.
 *
 * This is the ONE cause walker. `src/lib/memory/hindsight-request.ts`
 * still carries a second copy of the same loop (shipped in 8247b3ab for
 * the same reason, against Hindsight rather than the gateway); that file
 * is outside this task's claims, so folding it onto this helper is a
 * separate change, not a silent one.
 */
export function errorChain(e: unknown, maxDepth = 5): Error[] {
  const chain: Error[] = [];
  let current: unknown = e;
  for (let depth = 0; depth < maxDepth && current instanceof Error; depth++) {
    chain.push(current);
    current = (current as { cause?: unknown }).cause;
  }
  return chain;
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
 * It also unwraps the cause chain, joining the distinct links with ": ",
 * so `TypeError: fetch failed` reaches the user as
 * `fetch failed: connect ECONNREFUSED 127.0.0.1:8642`. A cause whose text
 * an outer link already quotes is dropped rather than repeated: wrappers
 * that interpolate their own cause are common, and saying it twice reads
 * as two faults.
 *
 * @example
 *   } catch (err) {
 *     showToast(messageFromError(err, "Failed to load"), "error");
 *   }
 */
export function messageFromError(e: unknown, fallback: string): string {
  const parts: string[] = [];
  for (const link of errorChain(toError(e))) {
    const message = link.message.trim();
    if (!message) continue;
    if (parts.some((seen) => seen.includes(message))) continue;
    parts.push(message);
  }
  return parts.join(": ") || fallback;
}

/**
 * How long the browser waits for one API call before giving up on it.
 *
 * Deliberately LONGER than the server's own deadline. HermesRuntime times its
 * gateway calls out at 30s, so a route that is waiting on a stopped gateway
 * answers at ~30s with a real diagnosis. A client deadline at or under that
 * would win the race and replace the diagnosis with "timed out", which is the
 * one thing the user already knows. Above it, the server's answer arrives
 * first and this only ever catches the case where no answer is coming at all.
 *
 * Without any deadline the chat composer sat on "Thinking…" for as long as the
 * server took, with no upper bound and nothing on screen to say why.
 */
export const API_FETCH_TIMEOUT_MS = 45_000;

/**
 * A deadline signal, or null where the runtime has no `AbortSignal.timeout`
 * (older jsdom in particular). No signal is strictly better than throwing at
 * the first line of every fetch in the app.
 */
function timeoutSignal(): AbortSignal | null {
  if (typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") return null;
  return AbortSignal.timeout(API_FETCH_TIMEOUT_MS);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic JSON fetch returns arbitrary shapes
export async function apiFetch<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  // A caller-supplied signal always wins: several call sites use one to cancel
  // on unmount or on a superseded request, and overriding it would leak both
  // the request and the state update it resolves into.
  const deadline = options?.signal ? null : timeoutSignal();

  let res: Response;
  try {
    res = await fetch(path, {
      ...options,
      signal: options?.signal ?? deadline,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
  } catch (e) {
    if (deadline?.aborted) {
      throw new Error(
        `No response after ${Math.round(API_FETCH_TIMEOUT_MS / 1000)}s (${path})`,
      );
    }
    throw e;
  }

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
class ApiError extends Error {
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
