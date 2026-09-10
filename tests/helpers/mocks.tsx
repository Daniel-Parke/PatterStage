/**
 * Shared jest.mock factories (U1, T-0115).
 *
 * Each function here is one stanza that appeared IDENTICALLY, byte for byte, in
 * enough test files to be worth a name. Nothing here is a general-purpose mock:
 * a target with several shapes keeps them, because a mock with a per-file
 * factory is testing something its neighbour is not.
 *
 * Call them through `require` inside the factory, never through an import:
 *
 *   jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
 *
 * `jest.mock` is hoisted above every import in the file, so an imported binding
 * is not guaranteed to be initialised when the factory runs. `require` inside
 * the factory is the form jest documents for exactly this, and it keeps the
 * mock OPT-IN: a file that wants the real module simply does not call.
 *
 * Every factory builds a fresh object per call. A shared instance would leak a
 * `mockReturnValueOnce` from one file into the next, which is the thing jest's
 * per-file module registry exists to prevent.
 */
import type { ReactElement, ReactNode } from "react";

/**
 * Every lucide icon, as a component rendering a named svg.
 *
 * A Proxy rather than a list, so a test never has to enumerate the icons the
 * component under test happens to import; adding an icon to a screen does not
 * break its test. `data-icon` carries the name so an assertion can tell one
 * icon from another, and `aria-hidden` matches what the real package renders,
 * so the icon-button name gate reads the same tree the browser would.
 */
export function lucideMock(): Record<string, unknown> {
  const icon = (name: string) =>
    function Icon(props: Record<string, unknown>) {
      return <svg data-icon={name} aria-hidden="true" {...props} />;
    };
  return new Proxy({}, { get: (_t, prop: string) => icon(prop) });
}

/** The page frame as a plain div: 29 pages wear it and no test is about it. */
export function appPageShellMock(): {
  __esModule: true;
  default: (props: { children: ReactNode; header?: ReactNode }) => ReactElement;
} {
  return {
    __esModule: true,
    // `header` is rendered, not dropped. It is a PROP rather than a child
    // (T-0117), so a mock that only forwarded children would silently erase
    // every page's title, subtitle and header actions — and the assertions
    // that look for them would then be passing against nothing.
    default: ({ children, header }: { children: ReactNode; header?: ReactNode }) => (
      <div>
        {header}
        {children}
      </div>
    ),
  };
}

/**
 * next/link as a real anchor.
 *
 * The rest of the props are spread through deliberately: several call sites
 * assert on `aria-current` or a className that the component puts on the Link,
 * and a mock that dropped them would make those assertions pass against
 * nothing.
 */
export function nextLinkMock(): {
  __esModule: true;
  default: (props: { href: string; children: ReactNode } & Record<string, unknown>) => ReactElement;
} {
  return {
    __esModule: true,
    default: ({
      href,
      children,
      ...rest
    }: { href: string; children: ReactNode } & Record<string, unknown>) => (
      <a href={href} {...rest}>
        {children}
      </a>
    ),
  };
}

/**
 * next/server's NextResponse, small enough to assert against.
 *
 * The real one needs a Request/Response environment a node test does not have.
 * This keeps the two things a route test reads: the status, and a body it can
 * await.
 */
const STATUS_TEXT: Record<number, string> = {
  200: "OK", 201: "Created", 204: "No Content", 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden",
  404: "Not Found", 405: "Method Not Allowed", 409: "Conflict", 422: "Unprocessable Entity", 500: "Internal Server Error", 503: "Service Unavailable",
};

export interface MockNextRequest {
  url: string;
  method: string;
  headers: Headers;
  nextUrl: URL;
  bodyUsed: boolean;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export interface MockNextResponse {
  status: number;
  ok: boolean;
  statusText: string;
  headers: Headers;
  body: unknown;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/**
 * next/server as the two classes the routes touch: a request that parses the
 * body it was given and carries `nextUrl`, and a response that
 * `NextResponse.json(data, init)` builds with `status`, `ok`, `statusText`,
 * `headers` and the data. Both are classes so `instanceof` holds where
 * parse-json-body checks it (C4, T-0141: thirteen suites spelled these).
 */
export function nextServerMock(): {
  NextRequest: new (url: string, init?: RequestInit) => MockNextRequest;
  NextResponse: {
    new (data?: unknown, init?: ResponseInit): MockNextResponse;
    json(data: unknown, init?: ResponseInit): MockNextResponse;
  };
} {
  class NextRequest implements MockNextRequest {
    url: string;
    method: string;
    headers: Headers;
    nextUrl: URL;
    bodyUsed = false;
    private _body: string;
    constructor(url: string, init?: RequestInit) {
      this.url = url;
      this.method = init?.method ?? "GET";
      this.headers = new Headers(init?.headers as HeadersInit);
      this._body = typeof init?.body === "string" ? init.body : JSON.stringify(init?.body ?? {});
      this.nextUrl = new URL(url, "http://localhost");
    }
    async json() {
      return JSON.parse(this._body) as unknown;
    }
    async text() {
      return this._body;
    }
  }
  class NextResponse implements MockNextResponse {
    status: number;
    ok: boolean;
    statusText: string;
    headers: Headers;
    body: unknown;
    constructor(data?: unknown, init?: ResponseInit) {
      this.body = data;
      this.status = init?.status ?? 200;
      this.ok = this.status >= 200 && this.status < 300;
      this.statusText = init?.statusText ?? STATUS_TEXT[this.status] ?? "";
      this.headers = new Headers(init?.headers);
    }
    async json() {
      return this.body;
    }
    async text() {
      return JSON.stringify(this.body);
    }
    static json(data: unknown, init?: ResponseInit) {
      return new NextResponse(data, init);
    }
  }
  return { NextRequest, NextResponse };
}

/** The data directory, pinned under /tmp so no test reads the operator's own. */
export function pathsMock(over: { PATHS?: Record<string, string> } & Record<string, unknown> = {}) {
  const { PATHS: pathsOver, ...rest } = over;
  return {
    ...rest,
    PS_DATA_DIR: "/tmp/ch-data",
    PATHS: {
      missions: "/tmp/ch-data/missions",
      patterStageDb: "/tmp/ch-data/control-hub.db",
      templates: "/tmp/ch-data/templates",
      stories: "/tmp/ch-data/stories",
      recroom: "/tmp/ch-data/recroom",
      workspaces: "/tmp/ch-data/workspaces",
      auditLog: "/tmp/ch-data/audit",
      psScripts: "/tmp/ch-data/scripts",
      psHardwareLogs: "/tmp/ch-data/logs",
      ...pathsOver,
    },
    getPsScriptsDir: () => "/tmp/ch-data/scripts",
    getPsHardwareLogDir: () => "/tmp/ch-data/logs",
  };
}

/**
 * The Hermes adapter's paths and endpoints, pinned under /tmp/test-hermes.
 *
 * `jest.fn()` rather than plain functions, because several call sites do
 * `jest.mocked(getActiveHermesPaths).mockReturnValueOnce(...)` to test what
 * happens when the layout is different.
 */
export function agentRuntimeMock() {
  return {
    getActiveHermesPaths: jest.fn(() => ({
      root: "/tmp/test-hermes",
      config: "/tmp/test-hermes/config.yaml",
      backups: "/tmp/test-hermes/backups",
      env: "/tmp/test-hermes/.env",
      soul: "/tmp/test-hermes/SOUL.md",
      hermes: "/tmp/test-hermes/HERMES.md",
      agents: "/tmp/test-hermes/AGENTS.md",
      skills: "/tmp/test-hermes/skills",
      profiles: "/tmp/test-hermes/profiles",
      sessions: "/tmp/test-hermes/sessions",
      logs: "/tmp/test-hermes/logs",
      cronJobs: "/tmp/test-hermes/cron/jobs.json",
      memoryDb: "/tmp/test-hermes/memory_store.db",
    })),
    getActiveHermesHome: jest.fn(() => "/tmp/test-hermes"),
    getAgentLlmEndpoints: jest.fn(() => ({
      apiUrl: "http://127.0.0.1:9/v1/chat/completions",
      gatewayBase: "http://127.0.0.1:9",
    })),
  };
}

// ── C4 (T-0141): the stanzas the census found pasted across the corpus ──

/**
 * `@/lib/db` as a stub: nothing reaches a database. The default `now` and
 * `uuid` are fixed strings, so a suite that reads a timestamp or an id back
 * gets the same one every run; pass the suite's own where it asserted them.
 */
export function dbMock(over: { now?: () => string; uuid?: () => string; getDb?: () => unknown } = {}) {
  return {
    ensureDb: jest.fn(),
    getDb: over.getDb ? jest.fn(over.getDb) : jest.fn(),
    now: over.now ?? (() => "2026-01-01T00:00:00.000Z"),
    uuid: over.uuid ?? (() => "test-uuid"),
    inTransaction: <T,>(fn: () => T) => fn(),
  };
}

/** `window.matchMedia` answering every query the same way, with the listener surface jsdom lacks. */
export function matchMediaMock(matches: boolean | ((query: string) => boolean) = false): void {
  window.matchMedia = jest.fn((query: string) => ({
    matches: typeof matches === "function" ? matches(query) : matches,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
}

/**
 * The ProfilePicker as a plain select over two profiles, so a page suite can
 * change the profile without the real picker's listbox.
 */
export function profilePickerMock(): {
  __esModule: true;
  default: (props: { value: string; onChange: (v: string) => void }) => ReactElement;
} {
  return {
    __esModule: true,
    default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
      <select aria-label="Profile" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="default">Bob</option>
        <option value="qa">QA Engineer</option>
      </select>
    ),
  };
}

/**
 * The agent runtime over a Hermes home the suite creates per test and names
 * through `global.__FAKE_HERMES_ROOT__`, so the paths follow the temp dir.
 */
export function agentRuntimeFakeRootMock() {
  const root = () => (global as { __FAKE_HERMES_ROOT__?: string }).__FAKE_HERMES_ROOT__!;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- inside a jest.mock factory, where imports are not yet resolved
  const { join } = require("path") as typeof import("path");
  return {
    getActiveHermesPaths: () => ({
      root: root(),
      env: join(root(), ".env"),
      soul: join(root(), "SOUL.md"),
      hermes: join(root(), "HERMES.md"),
      agents: join(root(), "AGENTS.md"),
      skills: join(root(), "skills"),
      profiles: join(root(), "profiles"),
      sessions: join(root(), "sessions"),
      logs: join(root(), "logs"),
      config: join(root(), "config.yaml"),
      backups: join(root(), "backups"),
      cronJobs: join(root(), "cron", "jobs.json"),
      memoryDb: join(root(), "memory_store.db"),
    }),
    getActiveHermesHome: () => root(),
  };
}

/**
 * `safeApiCall` over an `apiFetch` double: `{ ok, data }` on a resolve,
 * `{ ok: false, error }` on a throw. A screen that reads through
 * useApiResource calls safeApiCall; a suite that answers reads through an
 * apiFetch mock routes both through the one map so a read is still one of
 * the paths it asked for (C6, T-0143). Inside `jest.mock`, through the
 * hoisting-safe `require` form.
 */
export function safeApiCallOver(fetchDouble: (...a: unknown[]) => unknown) {
  return async (...a: unknown[]) => {
    try {
      return { ok: true, data: await fetchDouble(...a) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };
}

/**
 * The inverse: `apiFetch` over a `safeApiCall` double whose answers keep
 * safeApiCall's shape (`{ ok, status, data, error, body }`). The data on ok;
 * otherwise a throw carrying the status and the parsed body, which is what
 * the real apiFetch throws. A JSON body is parsed back so the double sees
 * the object the suite's answers are keyed on (C6, T-0143).
 */
export function apiFetchOver(
  safeDouble: (url: string, init?: Record<string, unknown>) => Promise<{ ok: boolean; status?: number; data?: unknown; error?: string; body?: unknown }>,
) {
  return async (url: string, init?: { method?: string; body?: string }) => {
    const answer = await safeDouble(url, { ...init, body: init?.body === undefined ? undefined : JSON.parse(init.body) });
    if (answer.ok) return answer.data;
    throw Object.assign(new Error(answer.error ?? `HTTP ${answer.status}`), { status: answer.status, body: answer.body });
  };
}
