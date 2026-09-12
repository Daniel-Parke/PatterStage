// api-fetch — the one API fetch in the client, and the error helpers beside it.

export function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

/**
 * Walk an error's `cause` chain, outermost first, stopping at the first
 * non-Error link. Node's fetch throws `TypeError: fetch failed` and puts the
 * real reason one level down (`connect ECONNREFUSED ...`); reading `.message`
 * alone reported the wrapper, which is how a stopped gateway became "run failed".
 *
 * A non-Error input yields an EMPTY chain, not a wrapped one:
 * `isHindsightConnectionError` relies on a bare string not counting as a
 * transport failure; callers wanting coercion compose with `toError()` first.
 * The depth cap makes a cyclic `cause` terminate.
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
 * Coerce a caught value to a user-facing message, or `fallback` when empty.
 * Joins the distinct cause-chain links with ": ", dropping a cause an outer
 * link already quotes, since saying it twice reads as two faults.
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
 * Client deadline for one INTERACTIVE call. Deliberately LONGER than the
 * server's: HermesRuntime times gateway calls out at 30s with a real
 * diagnosis, and a client deadline at or under that would replace it with
 * "timed out". Without any deadline the composer sat on "Thinking…" unbounded.
 *
 * This is the default for every `apiFetch` call (T-0047), which is right for
 * anything a person waits on and wrong for bulk work; see
 * `API_FETCH_BULK_TIMEOUT_MS`. Callers choose.
 */
export const API_FETCH_TIMEOUT_MS = 45_000;

/**
 * The ceiling for bulk operations (push/pull all, catalogue sync, seeding),
 * whose work scales with the install: under the interactive ceiling a large
 * install had its sync aborted mid-flight and called it a timeout. Five
 * minutes: long enough that reaching it means genuinely stuck, short enough
 * that a wedged request does not hold a spinner forever.
 */
export const API_FETCH_BULK_TIMEOUT_MS = 300_000;

/** Null where the runtime lacks `AbortSignal.timeout` (older jsdom): no signal beats throwing on every fetch. */
function timeoutSignal(ms: number): AbortSignal | null {
  if (typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") return null;
  return AbortSignal.timeout(ms);
}

/** `RequestInit`, plus the deadline this one call wants. */
export interface ApiFetchOptions extends RequestInit {
  /** Milliseconds before this call is abandoned. Defaults to `API_FETCH_TIMEOUT_MS`; ignored when the caller passes its own `signal`. */
  timeoutMs?: number;
}

/**
 * The message a failing route published, or null. Top-level `error` is the
 * contract every factory in `@/lib/api/api-response` sets, and wins; some routes
 * answer their catch branch in the success envelope, so `data.error` is read
 * second (`/api/memory/hindsight` explained itself perfectly and the operator
 * saw "HTTP 500"). ONLY `error` is read at either depth: a failure body can
 * carry a stack, a path or a token, none of which belongs in a toast. An
 * empty string is returned as-is so `messageFromError`'s fallback applies.
 */
function publishedErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const top = (body as { error?: unknown }).error;
  if (typeof top === "string") return top;
  const data = (body as { data?: unknown }).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const nested = (data as { error?: unknown }).error;
  return typeof nested === "string" ? nested : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic JSON fetch returns arbitrary shapes
export async function apiFetch<T = any>(
  path: string,
  options?: ApiFetchOptions
): Promise<T> {
  // Ours, not the platform's: kept out of the RequestInit that reaches fetch.
  const { timeoutMs, ...init } = options ?? {};
  const budget = timeoutMs ?? API_FETCH_TIMEOUT_MS;

  // A caller-supplied signal always wins: sites use one to cancel on unmount
  // or supersession, and overriding it would leak the request and its update.
  const deadline = init.signal ? null : timeoutSignal(budget);

  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      signal: init.signal ?? deadline,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch (e) {
    if (deadline?.aborted) {
      // Report the budget that fired, not the default: "no response after
      // 45s" on a call that waited five minutes sends the reader astray.
      throw new Error(
        `No response after ${Math.round(budget / 1000)}s (${path})`,
      );
    }
    throw e;
  }

  const json = await res.json().catch(() => {
    throw new Error(`API returned invalid JSON (HTTP ${res.status})`);
  });

  if (!res.ok) {
    const base = publishedErrorMessage(json) ?? `HTTP ${res.status}`;
    const push =
      typeof json.cronPushError === "string" && json.cronPushError.trim()
        ? json.cronPushError
        : null;
    throw new ApiError(push ? `${base}: ${push}` : base, res.status, json);
  }

  return json;
}

/**
 * A non-2xx response, carrying status and parsed body: a message string is
 * enough for a toast but not to act on a status (a 409 a user can resolve is
 * not a 500).
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

/** Return shape of `safeApiCall`, the non-throwing wrapper for hooks and event handlers; `runMutation` consumers read fields beyond ok/error. */
export type SafeApiCallResult<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: string;
  /** HTTP status when the call reached the server; absent on a network failure. */
  status?: number;
  /** Parsed error body, for fields the message does not carry. */
  body?: unknown;
};

export async function safeApiCall<T = unknown>(
  path: string,
  options?: Omit<ApiFetchOptions, "body"> & { body?: unknown }
): Promise<SafeApiCallResult<T>> {
  try {
    const data = await apiFetch(path, {
      ...options,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    return { ok: true, data: data as T };
  } catch (e) {
    if (e instanceof ApiError) {
      // messageFromError, not e.message: `{ error: "" }` must still toast something.
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
 * `safeApiCall` with the `{ data: T }` envelope unwrapped; null on error and on
 * a 200 with no `data`. Use `safeApiCall` when you need `ok`/`error` or the
 * response is not an envelope.
 */
export async function safeApiCallData<T = unknown>(
  path: string,
  options?: Omit<ApiFetchOptions, "body"> & { body?: unknown }
): Promise<T | null> {
  const { ok, data } = await safeApiCall<{ data?: T }>(path, options);
  if (!ok) return null;
  return (data?.data ?? null) as T | null;
}

/** `useToast().showToast`'s shape, not imported: ui/Toast is a client component
 *  and this file is shared with server code. */
type ShowToastFn = (message: string, type?: "success" | "error" | "info") => void;

/** Toast a caught error, with `messageFromError`'s fallback discipline. */
export function toastError(
  showToast: ShowToastFn,
  err: unknown,
  fallback: string,
): void {
  showToast(messageFromError(err, fallback), "error");
}

/** A `useState<string | null>` setter's shape, not imported to keep React out of this module. */
type SetErrorFn = (value: string | null) => void;

/**
 * The `setError` sibling of `toastError`. Returns the message so a caller that
 * needs it for state AND a side-effect resolves it once.
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
