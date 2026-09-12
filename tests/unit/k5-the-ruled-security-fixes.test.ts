/**
 * @jest-environment node
 *
 * K5 · The three security findings the operator ruled on (T-0153).
 *
 * Written before the fixes exist, by a session that will not implement them.
 * Each case is the behaviour the ruling asks for, stated so that doing the
 * wrong thing cannot satisfy it.
 *
 *   critic-04  Every response forbids framing. A `headers()` entry in
 *              next.config.ts sends `X-Frame-Options: DENY` and a CSP whose
 *              `frame-ancestors` is `'none'`, on every path. Ruled "Forbid
 *              framing everywhere" (2026-09-12). The premise is that nothing
 *              embeds PatterStage, so the premise is pinned here too: if a
 *              future change adds an embedder, DENY stops being free and the
 *              operator has to be asked again (I4).
 *
 *   app-06     Read-only is enforced by the proxy, and the eleven route-level
 *              checks that cannot fire over HTTP go; the six on the routes
 *              whose writes reach the host stay, because proxy.ts:58-63 and
 *              api.md:259 promise a second guard there; the three documented
 *              GET skips stay. Ruled "Proxy only, host-side routes keep
 *              theirs" (2026-09-12).
 *
 *   critic-05a Documentation only. The signature format does not change; what
 *              changes is that the documents admit what it does not cover.
 *              Ruled "Keep the format and document the gap" (2026-09-12).
 *
 * THE ORDER OF THE CASES IS THE ORDER OF THE RISK. The first describe below is
 * the one that matters most: with PS_READ_ONLY set, a write to every route
 * losing its guard is still refused THROUGH THE PROXY with a 503. Eleven
 * refusals are being deleted, and the whole argument for deleting them is that
 * the proxy already answered first. If that stops being true the batch has
 * removed a real refusal, and this is the case that says so. It is green today
 * and must be green afterwards; a batch that turns it red has failed whatever
 * else it did.
 *
 * WHAT IS DELIBERATELY NOT ASSERTED HERE, and why:
 *
 *   - No `script-src`. The register's critic-04 entry rules exactly two
 *     headers; a content policy over scripts is a different question that has
 *     not been asked. This oracle neither requires one nor forbids one.
 *
 *   - The output canary is not re-run. next.config.ts is one of the files the
 *     canary's `appConfig` surface hashes, and the hash is over a NORMALISED
 *     form the script computes; reproducing that normalisation here would be a
 *     second copy of the script, which is the way two answers to one question
 *     start to drift. `npm run canary:check` owns it. The batch must re-bless
 *     `scripts/tooling/output-canary.golden.json` for the headers() entry, and
 *     that is a gate failure, not a test failure.
 *
 *   - The three documented GET skips are pinned here structurally (the set of
 *     live guard call sites, below), not behaviourally. Their behaviour —
 *     the read answers and the bookkeeping write is skipped — already has a
 *     suite of its own at tests/unit/b1-read-only-reads-do-not-write.test.ts,
 *     with the mock stack each of the three routes needs. Copying forty lines
 *     of another suite's mocks in here would give a second thing to keep in
 *     step for no assertion the pair does not already make. That suite must
 *     stay green; this one holds the count and the pragma.
 *
 *   - Nothing asserts that a particular route file stopped IMPORTING
 *     `requireNotReadOnly`. The function is required to be gone from the
 *     module, which is stronger: an import of something that is not exported
 *     does not typecheck.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createHmac } from "node:crypto";

import { NextRequest } from "next/server";

import nextConfig from "../../next.config";
import { SESSION_COOKIE } from "@/lib/api/auth-token";

const ROOT = join(__dirname, "..", "..");
const API_ROOT = join(ROOT, "src", "app", "api");
const readRepoFile = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf-8");

/**
 * A repo-relative, posix-separated path.
 *
 * `relative()` rather than splitting an absolute path on a marker segment. The
 * marker form is the house idiom and it is a trap off this machine: CI checks
 * this repository out at `/home/runner/work/PatterStage/PatterStage`, so
 * splitting on "/PatterStage/" yields "PatterStage/src/..." there and "src/..."
 * here, and a case built on it passes locally and fails on Linux for a reason
 * that has nothing to do with the batch. That is the K4 lesson, in the one
 * shape it can still take.
 */
const rel = (from: string, file: string) => relative(from, file).split(sep).join("/");

const TOKEN = "test-token-abcdefghijklmnop";

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

// ════════════════════════════════════════════════════════════════
// app-06 · I1 — over HTTP, read-only refuses exactly what it refused
// ════════════════════════════════════════════════════════════════

/**
 * The eleven route-level checks the ruling deletes, each as the request that
 * used to reach it. The METHOD is the one the deleted guard actually sat in:
 * both skills guards are in PUT, not POST, so a list written from the route
 * names alone would test a method no handler declares and prove nothing about
 * the guard being removed.
 */
const LOSES_ITS_ROUTE_LEVEL_CHECK: Array<[string, string]> = [
  ["POST", "/api/backup"],
  ["POST", "/api/composer/runs/run-1/cancel"],
  ["POST", "/api/missions"],
  ["POST", "/api/missions/m1/cancel"],
  ["PUT", "/api/prefs"],
  ["POST", "/api/seed"],
  ["PUT", "/api/skills/some-skill"],
  ["PUT", "/api/skills/some-skill/toggle"],
  ["POST", "/api/tools"],
  ["POST", "/api/admin/sessions/backfill-status"],
  ["POST", "/api/sessions"],
];

/** The six the ruling keeps. Over HTTP they answer the same 503 as the rest. */
const KEEPS_ITS_ROUTE_LEVEL_CHECK: Array<[string, string]> = [
  ["POST", "/api/cron/hardware"],
  ["PUT", "/api/cron/hardware"],
  ["DELETE", "/api/cron/hardware"],
  ["PUT", "/api/scripts/backup.sh"],
  ["DELETE", "/api/scripts/backup.sh"],
  ["POST", "/api/scripts/run"],
];

describe("K5 · app-06 · read-only still refuses over HTTP everything it refused", () => {
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

  const both = [...LOSES_ITS_ROUTE_LEVEL_CHECK, ...KEEPS_ITS_ROUTE_LEVEL_CHECK];

  it.each(both)("%s %s is refused with a 503 that carries the remedy", async (method, path) => {
    // Status and sentence together, because the status alone would pass on any
    // 503 the tree happens to answer — a missing migration, a sync layer that
    // is down — and the sentence is what the deleted route-level guards
    // produced. The operator reads the same one whichever layer refused.
    process.env.PS_READ_ONLY = "1";
    const proxy = await loadProxy();
    const res = proxy(
      req(`http://localhost:4242${path}`, {
        method,
        headers: { authorization: `Bearer ${TOKEN}` },
      }),
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/read-only mode/i);
    expect(body.error).toMatch(/unset PS_READ_ONLY/i);
  });

  it.each([...new Set(both.map(([, path]) => path))])(
    "GET %s is still served, because read-only reads",
    async (path) => {
      process.env.PS_READ_ONLY = "1";
      const proxy = await loadProxy();
      const res = proxy(
        req(`http://localhost:4242${path}`, { headers: { authorization: `Bearer ${TOKEN}` } }),
      );
      expect(res.status).toBe(200);
    },
  );

  it("still authenticates before it refuses, so an anonymous write learns nothing", async () => {
    // The ordering is the reason the refusal is at this layer at all (T-0048).
    // A batch that moved the read-only branch above the token check would pass
    // every case above and break this one.
    process.env.PS_READ_ONLY = "1";
    const proxy = await loadProxy();
    expect(proxy(req("http://localhost:4242/api/backup", { method: "POST" })).status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════
// app-06 · I2/I3 — what is left at the route level, exactly
// ════════════════════════════════════════════════════════════════

/** `// check-read-only-guards-disable-next-line -- <reason>`, reason required. */
const PRAGMA = /\/\/\s*check-read-only-guards-disable-next-line\s+--\s+\S/;
const HANDLER =
  /^export (?:(?:async )?function (GET|HEAD|OPTIONS|POST|PUT|DELETE|PATCH)\b|const (GET|HEAD|OPTIONS|POST|PUT|DELETE|PATCH) = route\()/;
const GUARD = /\b(requireAuth|requireNotReadOnly|isReadOnly)\s*\(/;
const HOST_GUARD = /\brequireAuthenticatedHostWrites\s*\(/;

function routeFiles(dir = API_ROOT, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) routeFiles(full, out);
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

let handlersSeen = 0;

/**
 * Every LIVE read-only guard call in the route tree, attributed to the handler
 * that encloses it.
 *
 * Comment-aware, the same way check-read-only-guards.mjs and design-lint are:
 * prose explaining why a route no longer carries a guard is the most useful
 * thing left in several of these files, and a scanner that counted it would
 * report a deletion that happened as a deletion that did not. It is also the
 * hazard the last mutation sweep found: a substring match over a whole file
 * cannot tell a call from a line that mentions one.
 */
function guardSites(): string[] {
  const sites: string[] = [];
  handlersSeen = 0;
  for (const file of routeFiles()) {
    const path = rel(API_ROOT, file);
    let method = "";
    let exempt = false;
    for (const raw of readFileSync(file, "utf-8").split(/\r?\n/)) {
      const handler = HANDLER.exec(raw);
      if (handler) {
        method = handler[1] ?? handler[2];
        handlersSeen += 1;
      }
      const trimmed = raw.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
        exempt = PRAGMA.test(raw);
        continue;
      }
      const guard = GUARD.exec(raw);
      if (guard) sites.push(`${path} ${method} ${guard[1]}${exempt ? " (documented skip)" : ""}`);
      exempt = false;
    }
  }
  return sites;
}

/**
 * The whole of what the ruling leaves at the route level: the six host-side
 * guards (I2) and the three documented GET skips (I3), and nothing else.
 *
 * A SET, never a count with a floor. The mutation sweep on the last batch
 * killed a case that counted occurrences against a floor loose enough to
 * survive the deletion it was written to catch. Equality fails on a deletion
 * and on an addition alike, and it names which one in the diff.
 */
const GUARDS_THE_RULING_LEAVES = [
  "agent/profiles/[id]/toolsets/route.ts GET isReadOnly (documented skip)",
  "cron/hardware/route.ts DELETE isReadOnly",
  "cron/hardware/route.ts POST isReadOnly",
  "cron/hardware/route.ts PUT isReadOnly",
  "scripts/[name]/route.ts DELETE isReadOnly",
  "scripts/[name]/route.ts PUT isReadOnly",
  "scripts/run/route.ts POST isReadOnly",
  "sessions/route.ts GET isReadOnly (documented skip)",
  "stats/route.ts GET isReadOnly (documented skip)",
].sort();

describe("K5 · app-06 · the route level keeps exactly the checks the ruling kept", () => {
  it("walks a real route tree, so an empty walk cannot read as a pass", () => {
    // The denominator. `routeFiles().length` only proves the walk ran; the rule
    // is about HANDLERS, and they are attributed by a regex. Rewrite the routes
    // in a third spelling and the attribution goes empty, at which point the
    // set below is empty too and every deletion "passes".
    guardSites();
    expect(routeFiles().length).toBeGreaterThan(50);
    expect(handlersSeen).toBeGreaterThan(50);
  });

  it("leaves the six host-side guards and the three documented skips, and no others", () => {
    expect(guardSites().sort()).toEqual(GUARDS_THE_RULING_LEAVES);
  });

  it("`requireNotReadOnly` is no longer exported at all", async () => {
    // The eleven call sites go and the function goes with them; the ruling says
    // "delete requireNotReadOnly itself once it is unused". Asserting on the
    // module, not on a file's text: an import of something that is not exported
    // does not typecheck, so this covers the call sites as well.
    const mod = await import("@/lib/api/api-auth");
    expect("requireNotReadOnly" in mod).toBe(false);
  });

  it("keeps the host-write guard beside every host-side read-only check", () => {
    // I2's actual claim is a PAIR: these routes keep a read-only check because
    // they already keep the auth-none check, and proxy.ts:58-63 gives the same
    // reason for both. A batch that deleted one of the two would still satisfy
    // the set above.
    const liveHostGuards = (routePath: string) =>
      readRepoFile("src", "app", "api", ...routePath.split("/"))
        .split(/\r?\n/)
        .filter((raw) => {
          const t = raw.trim();
          if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return false;
          return HOST_GUARD.test(raw);
        }).length;

    expect(liveHostGuards("cron/hardware/route.ts")).toBe(3);
    expect(liveHostGuards("scripts/[name]/route.ts")).toBe(2);
    expect(liveHostGuards("scripts/run/route.ts")).toBe(1);
  });

  it("the cron/hardware header stops claiming the directory carries no check", () => {
    // It says today, immediately above three routes that carry both: "No route
    // in this directory carries either check (T-0048)."
    //
    // Two assertions, because either alone is satisfiable by the wrong thing.
    // Deleting the sentence would pass a test that only forbade it, including
    // by deleting the whole comment; requiring a comment that mentions the two
    // checks would pass with the false sentence still sitting under it.
    const comments = readRepoFile("src", "app", "api", "cron", "hardware", "route.ts")
      .split(/\r?\n/)
      .filter((raw) => {
        const t = raw.trim();
        return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
      })
      .join("\n");

    expect(comments).not.toMatch(/no route in this directory carries either check/i);
    expect(comments).toMatch(/read-only/i);
    expect(comments).toMatch(/requireAuthenticatedHostWrites|host-affecting|host writes|host-side/i);
  });
});

// ════════════════════════════════════════════════════════════════
// app-06 · I2 — the host-side six refuse without the proxy
// ════════════════════════════════════════════════════════════════

describe("K5 · app-06 · a harness that bypasses the proxy is still refused on the host routes", () => {
  // This is the whole reason the six stay. Each handler is called DIRECTLY,
  // which is the case proxy.ts:58-63 says it deliberately guards for, and each
  // keeps its own resource-specific sentence — the second half of the ruling's
  // "and keep their resource-specific 503 wording".
  const savedEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.PS_AUTH_MODE;
    process.env.PS_READ_ONLY = "1";
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  const bodyOf = async (res: Response) => ((await res.json()) as { error: string }).error;

  it.each(["POST", "PUT", "DELETE"] as const)(
    "%s /api/cron/hardware refuses and names the crontab",
    async (method) => {
      const route = (await import("@/app/api/cron/hardware/route")) as Record<
        string,
        (r: NextRequest) => Promise<Response>
      >;
      const res = await route[method](
        new NextRequest("http://localhost:4242/api/cron/hardware", { method }),
      );
      expect(res.status).toBe(503);
      expect(await bodyOf(res)).toBe(
        "PatterStage is in read-only mode: hardware cron jobs cannot be changed (unset PS_READ_ONLY to allow writes).",
      );
    },
  );

  it.each(["PUT", "DELETE"] as const)(
    "%s /api/scripts/[name] refuses and names the script editor",
    async (method) => {
      const route = (await import("@/app/api/scripts/[name]/route")) as Record<
        string,
        (r: NextRequest, ctx: { params: Promise<{ name: string }> }) => Promise<Response>
      >;
      const res = await route[method](
        new NextRequest("http://localhost:4242/api/scripts/backup.sh", {
          method,
          body: method === "PUT" ? JSON.stringify({ content: "#!/bin/sh\necho hi\n" }) : undefined,
          headers: method === "PUT" ? { "content-type": "application/json" } : undefined,
        }),
        { params: Promise.resolve({ name: "backup.sh" }) },
      );
      expect(res.status).toBe(503);
      expect(await bodyOf(res)).toBe(
        "PatterStage is in read-only mode: scripts cannot be edited or deleted (unset PS_READ_ONLY to allow writes).",
      );
    },
  );

  it("POST /api/scripts/run refuses and says a script cannot be run", async () => {
    const { POST } = await import("@/app/api/scripts/run/route");
    const res = await POST(
      new NextRequest("http://localhost:4242/api/scripts/run", {
        method: "POST",
        body: JSON.stringify({ name: "backup.sh" }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(503);
    expect(await bodyOf(res)).toBe(
      "PatterStage is in read-only mode: scripts cannot be run (unset PS_READ_ONLY to allow writes).",
    );
  });
});

// ════════════════════════════════════════════════════════════════
// app-06 · the deletion, seen from inside the handler
// ════════════════════════════════════════════════════════════════

describe("K5 · app-06 · a route that lost its check runs its own body instead", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.PS_AUTH_MODE;
    process.env.PS_READ_ONLY = "1";
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("POST /api/tools answers 405, the answer that was behind the guard", async () => {
    // The clearest of the eleven, and the one that needs no test double at all:
    // tools/route.ts puts a read-only guard in front of a 405, so under the
    // mode the route says "refused because read-only" about a method it does
    // not support in any mode. With the guard gone the honest answer arrives.
    //
    // A behavioural case, not a source scan: 503 here would mean the guard is
    // still in the handler however the file happens to be written.
    const { POST } = await import("@/app/api/tools/route");
    const res = await POST(new NextRequest("http://localhost:4242/api/tools", { method: "POST" }));
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET");
  });
});

// ════════════════════════════════════════════════════════════════
// critic-04 · nothing may frame PatterStage
// ════════════════════════════════════════════════════════════════

type HeaderEntry = { source: string; headers: Array<{ key: string; value: string }> };

/**
 * The source patterns Next treats as "every path". A narrower source is a real
 * difference — it would leave some responses framable — so this list is closed
 * on purpose: a spelling that is not here fails rather than being guessed at.
 */
const EVERY_PATH = new Set(["/:path*", "/(.*)"]);

async function headerEntries(): Promise<HeaderEntry[]> {
  const fn = nextConfig.headers;
  if (!fn) return [];
  return (await fn()) as HeaderEntry[];
}

const headerValue = (entry: HeaderEntry, key: string): string | undefined =>
  entry.headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

/** The directives of a CSP value, as `frame-ancestors 'none'` rather than a substring of one. */
const cspDirectives = (value: string): string[] =>
  value
    .split(";")
    .map((d) => d.trim().replace(/\s+/g, " "))
    .filter(Boolean);

describe("K5 · critic-04 · every response forbids framing", () => {
  it("next.config.ts declares a headers() entry at all", async () => {
    expect(typeof nextConfig.headers).toBe("function");
    expect((await headerEntries()).length).toBeGreaterThan(0);
  });

  it("sends X-Frame-Options: DENY on every path", async () => {
    const covering = (await headerEntries()).filter(
      (e) => EVERY_PATH.has(e.source) && headerValue(e, "X-Frame-Options") === "DENY",
    );
    expect(covering.map((e) => e.source)).not.toEqual([]);
  });

  it("sends a Content-Security-Policy whose frame-ancestors is 'none', on every path", async () => {
    // Directive equality, never `toContain`. `frame-ancestors 'self'` contains
    // "frame-ancestors", and so does a value that names an origin; both would
    // pass a substring test and neither is what was ruled.
    const covering = (await headerEntries()).filter((e) => {
      if (!EVERY_PATH.has(e.source)) return false;
      const csp = headerValue(e, "Content-Security-Policy");
      return csp !== undefined && cspDirectives(csp).includes("frame-ancestors 'none'");
    });
    expect(covering.map((e) => e.source)).not.toEqual([]);
  });

  it("carries no entry that relaxes either header for some other path", async () => {
    // DENY everywhere and SAMEORIGIN on one prefix is not what was ruled, and
    // the two cases above would both still pass with such an entry present.
    for (const entry of await headerEntries()) {
      const xfo = headerValue(entry, "X-Frame-Options");
      if (xfo !== undefined) expect({ source: entry.source, xfo }).toEqual({ source: entry.source, xfo: "DENY" });
      const csp = headerValue(entry, "Content-Security-Policy");
      if (csp !== undefined) {
        const ancestors = cspDirectives(csp).filter((d) => d.startsWith("frame-ancestors"));
        for (const directive of ancestors) {
          expect({ source: entry.source, directive }).toEqual({
            source: entry.source,
            directive: "frame-ancestors 'none'",
          });
        }
      }
    }
  });

  it("still answers every redirect it answered, and still allows the dev origins", async () => {
    // I5: next.config.ts gains an entry and loses nothing. The redirect
    // contract has a suite of its own (b3-old-paths-redirect); this is the
    // cheap guard against a rewrite of the file that takes something with it.
    const redirects = nextConfig.redirects ? await nextConfig.redirects() : [];
    expect(redirects.length).toBeGreaterThan(25);
    expect(nextConfig.allowedDevOrigins).toEqual(expect.arrayContaining(["localhost", "127.0.0.1"]));
    expect(nextConfig.serverExternalPackages).toEqual(expect.arrayContaining(["better-sqlite3"]));
  });
});

describe("K5 · critic-04 · the premise: nothing embeds PatterStage", () => {
  /**
   * I4, kept as a standing check rather than a one-off pre-flight.
   *
   * DENY costs nothing only while the answer is nothing. If a later change
   * frames a PatterStage page — a kiosk view, a dashboard tile, a docs demo —
   * this goes red and the framing ruling has to be taken back to the operator
   * rather than quietly breaking a surface.
   *
   * `src`, `docs` and `scripts` are the tracked trees an embedder could live
   * in. `public/` is deliberately out: its only contents are the generated
   * help output, which is untracked and rebuilt from `docs/`, so scanning it
   * would test the generator's markup rather than anybody's intent.
   */
  const EMBEDS = /iframe|frameElement|window\.top|window\.parent/i;
  const SKIP_DIR = new Set(["node_modules", ".next", "coverage"]);
  /** Read as text or not at all: a font or a screenshot is not prose about framing. */
  const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|pdf|zip|pyc|db|sqlite)$/i;

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIR.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (!BINARY.test(entry)) out.push(full);
    }
    return out;
  };

  it("finds no code or document that puts PatterStage in a frame", () => {
    const files = [
      ...walk(join(ROOT, "src")),
      ...walk(join(ROOT, "docs")),
      ...walk(join(ROOT, "scripts")),
      join(ROOT, "README.md"),
    ];
    expect(files.length).toBeGreaterThan(500);

    const hits: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf-8").split(/\r?\n/);
      lines.forEach((line, i) => {
        if (EMBEDS.test(line)) hits.push(`${rel(ROOT, file)}:${i + 1}`);
      });
    }

    // The two known hits, both re-verified in the register on 2026-09-12:
    // prose in the help page saying it is NOT an iframe, and an entry in a
    // focusable-element selector list. Neither embeds anything.
    expect(hits.sort()).toEqual([
      "src/app/help/[[...slug]]/page.tsx:80",
      "src/hooks/useDialogA11y.ts:42",
    ]);
  });
});

// ════════════════════════════════════════════════════════════════
// critic-05a · the format stays, and the documents say what it misses
// ════════════════════════════════════════════════════════════════

describe("K5 · critic-05a · the signature format is exactly what it was", () => {
  // I6. The ruling is documentation, so the first thing to hold is that
  // nothing about the verifier moved. Every case here is green today and must
  // still be green afterwards: a batch that "improved" the signature while
  // writing the paragraph has done the option the operator did not choose.
  const savedEnv = { ...process.env };
  const ts = () => Date.now().toString();
  const sign = (secret: string, method: string, path: string, at: string) =>
    createHmac("sha256", secret).update(`${method}:${path}:${at}`).digest("hex");

  beforeEach(() => {
    process.env.PS_REQUEST_SIGNING_SECRET = "ps-secret";
    delete process.env.CH_REQUEST_SIGNING_SECRET;
  });
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  const signedUpdate = async (body: unknown, at = ts(), headerNames = ["x-ps-ts", "x-ps-signature"]) => {
    const { requireSignedRequest } = await import("@/lib/api/api-auth");
    return requireSignedRequest(
      new NextRequest("http://localhost:4242/api/update", {
        method: "POST",
        headers: {
          [headerNames[0]]: at,
          [headerNames[1]]: sign("ps-secret", "POST", "/api/update", at),
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
  };

  it("accepts a signature over METHOD:path:ts", async () => {
    expect(await signedUpdate({ action: "restart" })).toBeNull();
  });

  it("accepts the same signature over a DIFFERENT body — this is the gap being documented", async () => {
    // The whole of critic-05a in one case. One timestamp, one signature, two
    // different actions, both accepted. If a batch signs the body after all,
    // this goes red and the ruling was not followed.
    const at = ts();
    expect(await signedUpdate({ action: "restart" }, at)).toBeNull();
    expect(await signedUpdate({ action: "update", branch: "main" }, at)).toBeNull();
  });

  it("still accepts the x-ch-* spellings", async () => {
    expect(await signedUpdate({ action: "restart" }, ts(), ["x-ch-ts", "x-ch-signature"])).toBeNull();
  });

  it("still refuses a signature older than five minutes", async () => {
    const at = (Date.now() - 6 * 60 * 1000).toString();
    expect((await signedUpdate({ action: "restart" }, at))?.status).toBe(401);
  });

  it("answers 401 to the unsigned request the app's own buttons send", async () => {
    // The second documented sentence, as behaviour. useVersionFooter posts to
    // /api/update with Content-Type and nothing else, so setting the secret
    // turns Update, Rebuild and Restart off.
    const { requireSignedRequest } = await import("@/lib/api/api-auth");
    const res = requireSignedRequest(
      new NextRequest("http://localhost:4242/api/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "restart" }),
      }),
    );
    expect(res?.status).toBe(401);
  });

  it("and the hook really does send no signature, so the sentence is true", () => {
    const hook = readRepoFile("src", "hooks", "useVersionFooter.ts");
    const live = hook
      .split(/\r?\n/)
      .filter((raw) => {
        const t = raw.trim();
        return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
      })
      .join("\n");
    expect(live).not.toMatch(/x-ps-signature|x-ch-signature|createHmac/);
  });
});

/**
 * The documented gap.
 *
 * A ruling whose whole content is two sentences can only be tested as text, so
 * the text is held to FACTS rather than to wording, and each fact is one the
 * behavioural cases above prove is true. The unit of matching is a sentence,
 * not a file or a section: `401` already appears in api.md's auth notes, and
 * "Update, Rebuild and Restart" already appears in env-reference's deploy
 * table, so a whole-section match would pass today on prose that says nothing
 * about the gap. Fenced code blocks and HTML comments are stripped first: a
 * markdown file can make a line inert and still contain its words.
 */
function docSection(file: string, heading: RegExp): string {
  const lines = readRepoFile(...file.split("/")).split(/\r?\n/);
  const start = lines.findIndex((l) => heading.test(l));
  if (start < 0) throw new Error(`${file}: no heading matching ${heading}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##\s/.test(l));
  return (end < 0 ? rest : rest.slice(0, end)).join("\n");
}

function sentences(markdown: string): string[] {
  const live = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  return live
    .split(/\n|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Facts the ruling requires, each as a predicate over one sentence. */
const GAP_FACTS: Array<[string, (s: string) => boolean]> = [
  [
    "the signature does not cover the request body",
    (s) =>
      /\bbody\b/i.test(s) &&
      /(does not|doesn'?t|never|not)\s+(cover|include|sign|extend)/i.test(s),
  ],
  [
    "a captured signed request can be replayed with another action or branch",
    (s) => /replay/i.test(s) && /\baction\b/i.test(s) && /\bbranch\b/i.test(s),
  ],
  [
    "setting the secret makes the in-app deploy buttons answer 401",
    (s) =>
      /\b401\b/.test(s) &&
      ["update", "rebuild", "restart"].filter((b) => new RegExp(`\\b${b}\\b`, "i").test(s)).length >= 2,
  ],
];

describe("K5 · critic-05a · docs/reference/api.md states the gap", () => {
  const section = () => docSection("docs/reference/api.md", /^##\s+Auth and safety notes/);

  it.each(GAP_FACTS)("says that %s", (_fact, holds) => {
    expect(sentences(section()).filter(holds)).not.toEqual([]);
  });

  it("still documents the format itself, which does not change", () => {
    expect(section()).toMatch(/METHOD:path:ts/);
    expect(section()).toMatch(/PS_REQUEST_SIGNING_SECRET/);
  });
});

describe("K5 · critic-05a · docs/running/env-reference.md states the gap", () => {
  const section = () => docSection("docs/running/env-reference.md", /^##\s+Deploy API/);

  it.each(GAP_FACTS)("says that %s", (_fact, holds) => {
    expect(sentences(section()).filter(holds)).not.toEqual([]);
  });

  it("still names the headers and the window, which do not change", () => {
    expect(section()).toMatch(/x-ps-ts/);
    expect(section()).toMatch(/x-ps-signature/);
    expect(section()).toMatch(/5 minute|five-minute|five minute/i);
  });
});

describe("K5 · critic-04 · docs/SECURITY.md says PatterStage refuses to be framed", () => {
  it("names framing and the header that forbids it", () => {
    // The ruling's option text asks for "a line in docs/SECURITY.md". A
    // security document that gained a header but not the sentence has left the
    // reader to discover it from a response.
    const security = sentences(readRepoFile("docs", "SECURITY.md"));
    const said = security.filter(
      (s) => /\bframe|framing|iframe|clickjack/i.test(s) && /X-Frame-Options|frame-ancestors/i.test(s),
    );
    expect(said).not.toEqual([]);
  });
});
