/** @jest-environment node */
/**
 * T-0048 acceptance oracle — read-only mode reads.
 *
 * `src/proxy.ts:171` has claimed since the security hotfix that "enforcing here
 * means read-only actually reads", and `src/app/api/missions/[id]/run/route.ts`
 * states the rule the tree was supposed to be normalised onto: "A GET that
 * refuses to answer under PS_READ_ONLY is a read-only mode that cannot read."
 *
 * T-0034 applied that to the `missions` directory and stopped there, by its own
 * invariant I2. The rest of the tree never followed. `requireAuth()` is a thin
 * alias for `requireNotReadOnly()` (`api-auth.ts:126`), and 34 GET handlers
 * across 33 files still call it, so `PS_READ_ONLY=1` 503s `/api/config`,
 * `/api/models`, `/api/skills`, `/api/sessions`, `/api/monitor` and `/api/logs`
 * — the dashboard's core reads. The mode blanks the UI it exists to enable.
 *
 * WHY IT SURVIVED 33 ROUTES, which is what the structural tests below exist to
 * stop: `tests/helpers/api-test-helpers.ts` mocks `@/lib/api-auth` wholesale
 * with `isReadOnly: () => false`, and roughly fifteen files repeat that inline.
 * Read-only mode does not exist in the unit suite. A test that asserts a route
 * answers under read-only cannot be written against a mock that has already
 * decided the answer, so these assertions read the real module and the real
 * environment variable.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

import { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth-token";

const TOKEN = "test-token-abcdefghijklmnop";
const API_ROOT = join(__dirname, "..", "..", "src", "app", "api");

function req(
  url: string,
  init: { method?: string; headers?: Record<string, string>; cookie?: string } = {},
): NextRequest {
  const headers: Record<string, string> = { host: "localhost:4242", ...(init.headers ?? {}) };
  if (init.cookie) headers.cookie = `${SESSION_COOKIE}=${init.cookie}`;
  return new NextRequest(url, { method: init.method ?? "GET", headers });
}

async function loadProxy() {
  jest.resetModules();
  const mod = await import("@/proxy");
  return mod.proxy;
}

/** Every route.ts under src/app/api, repo-relative and posix-separated. */
function routeFiles(dir = API_ROOT, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) routeFiles(full, out);
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

/**
 * Read-only guard calls, attributed to the HTTP method handler that encloses
 * them.
 *
 * Line-oriented on purpose: WG-WEB-013 forbids a parser dependency, and the
 * handlers are all `export async function <METHOD>` at column zero. Comment-only
 * lines are skipped so prose describing the anti-pattern does not register as
 * the anti-pattern, which is the same allowance `design-lint.mjs` makes.
 */
/**
 * How many HTTP handlers the attribution regex above actually recognised.
 *
 * This is the DENOMINATOR the sweep below was missing (filed in T-0066, closed
 * in T-0075). `files.length` only proves the WALK ran; the rule is about
 * HANDLERS, and they are attributed by a regex on `export [async] function
 * METHOD`. Rewrite a route as an exported const — or drift that pattern any
 * other way — and the attribution goes empty for every file, so every assertion
 * below passes vacuously against a full 96-file walk while reporting nothing.
 * The sibling script gets this right at check-read-only-guards.mjs:98 with
 * exactly this floor.
 */
let handlersSeen = 0;

/**
 * The one sanctioned exception, mirrored from check-read-only-guards.mjs: a
 * read handler that genuinely performs a write may consult the mode to SKIP
 * that write, and must say why on the line above (B1, T-0095: three GETs did
 * bookkeeping writes on every poll, and the fix is a guarded skip, not a 503).
 */
const PRAGMA = /\/\/\s*check-read-only-guards-disable-next-line\s+--\s+\S/;

function guardCallsByMethod(file: string): Array<{ method: string; line: number; text: string }> {
  const found: Array<{ method: string; line: number; text: string }> = [];
  let current = "";
  let exempt = false;
  const lines = readFileSync(file, "utf-8").split(/\r?\n/);
  lines.forEach((raw, i) => {
    const handler = /^export (?:async )?function (GET|HEAD|OPTIONS|POST|PUT|DELETE|PATCH)\b/.exec(raw);
    if (handler) {
      current = handler[1];
      handlersSeen += 1;
    }
    const trimmed = raw.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      exempt = PRAGMA.test(raw);
      return;
    }
    if (/\b(requireAuth|requireNotReadOnly|isReadOnly)\s*\(/.test(raw)) {
      if (exempt) {
        exempt = false;
        return;
      }
      found.push({ method: current, line: i + 1, text: trimmed });
    }
    exempt = false;
  });
  return found;
}

// ── The structural half: the migration is complete ──────────────

describe("the read-only guard has left the route handlers", () => {
  const files = routeFiles();

  it("finds a route tree to check, so an empty walk cannot read as a pass", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("and recognises the HANDLERS in it, which is the noun the rule is about", () => {
    files.forEach((f) => guardCallsByMethod(f));
    expect(handlersSeen).toBeGreaterThan(50);
  });

  it("no GET, HEAD or OPTIONS handler carries a read-only guard", () => {
    const offenders: string[] = [];
    for (const f of files) {
      for (const call of guardCallsByMethod(f)) {
        if (call.method === "GET" || call.method === "HEAD" || call.method === "OPTIONS") {
          offenders.push(`${f.replace(/\\/g, "/").split("/src/")[1]}:${call.line} (${call.method}) ${call.text}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("`requireAuth` is called nowhere in the route tree", () => {
    // Comment-aware, like design-lint. Prose recording WHY a route no longer
    // carries the guard is the most useful thing left in these files, and a
    // check that forbade the word outright would delete its own explanation.
    const callers = files.filter((file) =>
      readFileSync(file, "utf-8")
        .split(/\r?\n/)
        .some((raw) => {
          const t = raw.trim();
          if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return false;
          return /\brequireAuth\s*\(/.test(raw);
        }),
    );
    expect(callers.map((f) => f.replace(/\\/g, "/").split("/src/")[1])).toEqual([]);
  });

  it("`requireAuth` is no longer exported at all", async () => {
    const mod = await import("@/lib/api-auth");
    expect("requireAuth" in mod).toBe(false);
  });
});

// ── The behavioural half: the proxy owns the whole contract ─────

describe("proxy — read-only reads, refuses writes, and authenticates first", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    process.env.PS_AUTH_TOKEN = TOKEN;
    delete process.env.PS_AUTH_MODE;
    delete process.env.PS_READ_ONLY;
    delete process.env.CH_READ_ONLY;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("lets an authenticated read through under PS_READ_ONLY", async () => {
    process.env.PS_READ_ONLY = "1";
    const proxy = await loadProxy();
    const res = proxy(
      req("http://localhost:4242/api/sessions", { headers: { authorization: `Bearer ${TOKEN}` } }),
    );
    expect(res.status).toBe(200);
  });

  it("still refuses an authenticated write under PS_READ_ONLY", async () => {
    process.env.PS_READ_ONLY = "1";
    const proxy = await loadProxy();
    const res = proxy(
      req("http://localhost:4242/api/missions", {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}` },
      }),
    );
    expect(res.status).toBe(503);
  });

  it("authenticates BEFORE it refuses, so an anonymous write gets 401 not 503", async () => {
    // Ordering matters as a boundary, not a nicety. Refusing first tells an
    // unauthenticated caller whether the instance is read-only, and
    // `npm run start:network` binds 0.0.0.0.
    process.env.PS_READ_ONLY = "1";
    const proxy = await loadProxy();
    const res = proxy(req("http://localhost:4242/api/missions", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  // Every write route that used to carry its own `requireAuth` guard and had a
  // test pinning it. Those tests mocked `requireAuth` and asserted the handler
  // forwarded its response, so they exercised plumbing rather than the mode.
  // The guarantee they stood for is asserted here instead, at the layer that
  // now enforces it for EVERY route rather than the ones that remembered to ask.
  const FORMERLY_SELF_GUARDED = [
    "/api/templates",
    "/api/skills/some-skill",
    "/api/skills/some-skill/toggle",
    "/api/tools",
    "/api/models",
    "/api/memory",
    "/api/personalities",
    "/api/stories",
    "/api/credentials",
    "/api/update",
    "/api/backup",
  ];

  it.each(FORMERLY_SELF_GUARDED)("refuses a write to %s under PS_READ_ONLY", async (path) => {
    process.env.PS_READ_ONLY = "1";
    const proxy = await loadProxy();
    const res = proxy(
      req(`http://localhost:4242${path}`, {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}` },
      }),
    );
    expect(res.status).toBe(503);
  });

  it.each(FORMERLY_SELF_GUARDED)("still serves a READ of %s under PS_READ_ONLY", async (path) => {
    process.env.PS_READ_ONLY = "1";
    const proxy = await loadProxy();
    const res = proxy(
      req(`http://localhost:4242${path}`, { headers: { authorization: `Bearer ${TOKEN}` } }),
    );
    expect(res.status).toBe(200);
  });

  it("does not let a public path punch a write through read-only", async () => {
    // /api/health is GET-only today, so this is a guard on the guard: adding a
    // POST to a public path must not silently bypass the mode.
    // Authenticated on purpose. Anonymous, this would be 401 by the ordering
    // rule above, which would make the assertion about the wrong thing.
    process.env.PS_READ_ONLY = "1";
    const proxy = await loadProxy();
    const res = proxy(
      req("http://localhost:4242/api/health", {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}` },
      }),
    );
    expect(res.status).toBe(503);
  });

  it("still serves a public path for reads", async () => {
    const proxy = await loadProxy();
    expect(proxy(req("http://localhost:4242/api/health")).status).toBe(200);
  });
});

// ── One message, and it points the right way ────────────────────

describe("the read-only refusal says one true thing", () => {
  const savedEnv = { ...process.env };
  beforeEach(() => {
    process.env.PS_AUTH_TOKEN = TOKEN;
    delete process.env.PS_READ_ONLY;
  });
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("tells the operator to UNSET the flag, never to set it", async () => {
    process.env.PS_READ_ONLY = "1";
    const proxy = await loadProxy();
    const res = proxy(
      req("http://localhost:4242/api/missions", {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}` },
      }),
    );
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/unset PS_READ_ONLY/i);
    // The old api-auth wording told the operator to do the opposite of the fix.
    expect(body.error).not.toMatch(/set PS_READ_ONLY=true/i);
  });

  it("no source file still carries the backwards wording", () => {
    const offenders = routeFiles()
      .concat([join(__dirname, "..", "..", "src", "lib", "api-auth.ts")])
      .filter((f) => /set PS_READ_ONLY=true to allow writes/.test(readFileSync(f, "utf-8")));
    expect(offenders).toEqual([]);
  });
});
