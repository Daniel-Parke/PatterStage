// The fetch double a page suite installs: a map from path to answer, matched
// exact first and then by the longest prefix, and a throw for anything the
// suite did not think of, so an unstubbed read is a red and not a silent
// empty state. Eleven suites each spelled this before C4 (T-0140).

export interface FetchAnswer {
  body: unknown;
  status?: number;
}

/** A Response-shaped answer with the four members the app reads. */
export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

export interface FetchMapOptions {
  /** Answers a URL the map does not, or leaves it to the throw. */
  fallback?: (url: string, init?: RequestInit) => FetchAnswer | undefined;
}

/**
 * Install `global.fetch` over the map and hand back the mock, so a suite can
 * read its calls. Keys are paths (`/api/models`) or path prefixes; a URL is
 * matched exact first, then by the longest key it starts with.
 */
export function fetchMap(map: Record<string, FetchAnswer>, opts: FetchMapOptions = {}): jest.Mock {
  const mock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (map[url]) return jsonResponse(map[url].body, map[url].status);
    const key = Object.keys(map)
      .sort((a, b) => b.length - a.length)
      .find((k) => url.startsWith(k));
    if (key) return jsonResponse(map[key].body, map[key].status);
    const fallen = opts.fallback?.(url, init);
    if (fallen) return jsonResponse(fallen.body, fallen.status);
    throw new Error(`Unmatched fetch: ${url}`);
  });
  global.fetch = mock as unknown as typeof global.fetch;
  return mock;
}
