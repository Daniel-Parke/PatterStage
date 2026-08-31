/** @jest-environment node */

// T-0083 acceptance oracle — operator ruling 2, from QA finding 13.
//
// The reporter fired 130 requests at /api/sessions and never saw a 429. Two
// separate facts underneath:
//
//   1. A real sliding-window limiter EXISTS (sessions-api-guard.ts, 120/min)
//      and is wired to /api/sessions/[id] but NOT to the list route the tester
//      actually hit. That half is a wiring bug, tested separately.
//
//   2. The `ps_token` exchange has no brute-force protection at all. The
//      compare is constant-time, which stops a timing oracle and does nothing
//      about volume: an attacker on the LAN — `npm run start:network` binds
//      0.0.0.0 — can try tokens as fast as the event loop will take them.
//
// THE RULING was "auth throttle + fix wiring", not a general API limiter. So
// this covers the FAILED-AUTH path only, and its shape is decided by what
// PatterStage is: a local-first tool whose operator is usually indistinguishable
// from an attacker at the network layer, because on loopback both are "local".
//
// That rules out an UNBOUNDED lockout. A lock with no ceiling, keyed on a
// client that cannot be told apart from the operator, is a denial of service
// against the operator shipped as a security feature.
//
// What it does not rule out is a SHORT one, and a short one is the only kind
// that works. See the "door never welds shut" block below for why the softer
// alternative -- answer 429 but keep comparing -- is decoration: the attacker
// gets a comparison on every request either way and their guess rate is
// unchanged. So the penalty refuses to process at all, for seconds rather than
// minutes, and any correct token clears the record outright.

import { mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth-token";
import { FREE_AUTH_ATTEMPTS, MAX_AUTH_PENALTY_SECONDS } from "@/lib/auth-throttle";

const TOKEN = "test-token-abcdefghijklmnop";
const WRONG = "wrong-token-0000000000000";

function req(
  url: string,
  init: { method?: string; headers?: Record<string, string>; cookie?: string } = {},
): NextRequest {
  const headers: Record<string, string> = { host: "localhost:4242", ...(init.headers ?? {}) };
  if (init.cookie) headers.cookie = `${SESSION_COOKIE}=${init.cookie}`;
  return new NextRequest(url, { method: init.method ?? "GET", headers });
}

function bearer(token: string, from = "10.0.0.5") {
  return req("http://localhost:4242/api/sessions", {
    headers: { authorization: `Bearer ${token}`, "x-forwarded-for": from },
  });
}

let tokenDir: string;

async function loadProxy() {
  jest.resetModules();
  const mod = await import("@/proxy");
  return mod.proxy;
}

beforeEach(() => {
  tokenDir = join(tmpdir(), `ps-throttle-${Math.random().toString(36).slice(2)}`);
  process.env.PS_DATA_DIR = tokenDir;
  mkdirSync(tokenDir, { recursive: true });
  writeFileSync(join(tokenDir, "auth-token"), TOKEN, "utf-8");
});

afterEach(() => {
  rmSync(tokenDir, { recursive: true, force: true });
  delete process.env.PS_DATA_DIR;
});

describe("a wrong token starts costing something", () => {
  it("lets the first few failures through at full speed", async () => {
    // Fat-fingering a token is not an attack. The first handful of failures
    // must behave exactly as they do today, or a mistyped paste turns into a
    // support question.
    const proxy = await loadProxy();

    // Exactly the declared budget, not an arbitrary three: this asserts the
    // whole of the free allowance is actually free, so shrinking the constant
    // without meaning to is caught here rather than by a confused operator.
    for (let i = 0; i < FREE_AUTH_ATTEMPTS; i++) {
      expect(proxy(bearer(WRONG)).status).toBe(401);
    }
    expect(FREE_AUTH_ATTEMPTS).toBeGreaterThanOrEqual(3);
  });

  it("answers 429 once the failures stop looking like typos", async () => {
    const proxy = await loadProxy();

    let sawThrottle = false;
    for (let i = 0; i < 40 && !sawThrottle; i++) {
      if (proxy(bearer(WRONG)).status === 429) sawThrottle = true;
    }

    expect(sawThrottle).toBe(true);
  });

  it("says how long to wait, so a client can behave", async () => {
    const proxy = await loadProxy();

    let throttled: Response | null = null;
    for (let i = 0; i < 40 && !throttled; i++) {
      const res = proxy(bearer(WRONG));
      if (res.status === 429) throttled = res;
    }

    expect(throttled?.headers.get("retry-after")).toBeTruthy();
  });

  it("never reveals whether the token was close", async () => {
    // The throttle must not become the oracle the constant-time compare exists
    // to prevent. A 429 says "too many attempts" and nothing about the token.
    const proxy = await loadProxy();

    let throttled: Response | null = null;
    for (let i = 0; i < 40 && !throttled; i++) {
      const res = proxy(bearer(WRONG));
      if (res.status === 429) throttled = res;
    }
    const body = await throttled!.json();

    expect(JSON.stringify(body)).not.toContain(WRONG);
    expect(JSON.stringify(body)).not.toContain(TOKEN);
  });
});

describe("the door never welds shut", () => {
  // THE DESIGN QUESTION, and the reason these tests read the way they do.
  //
  // The tempting shape is "compare first, and answer 429 instead of 401 when
  // the client is over budget", because it never inconveniences a valid token.
  // It is also worthless: the attacker still gets a comparison on every
  // request and learns "wrong" just as fast, so their guess rate is completely
  // unchanged. A throttle that does not refuse to PROCESS is decoration.
  //
  // So the penalty window refuses everything from that client, valid token
  // included — and is therefore BOUNDED, hard, at a few seconds. An attacker's
  // rate collapses; an operator who fat-fingered a token six times waits once,
  // briefly, and the token they paste next works. A lockout with no ceiling
  // would be a denial of service against the operator shipped as a security
  // feature, which is the outcome this bound exists to prevent.

  it("the penalty is measured in seconds, not minutes", async () => {
    const proxy = await loadProxy();

    let throttled: Response | null = null;
    for (let i = 0; i < 40 && !throttled; i++) {
      const res = proxy(bearer(WRONG));
      if (res.status === 429) throttled = res;
    }

    expect(Number(throttled!.headers.get("retry-after"))).toBeLessThanOrEqual(
      MAX_AUTH_PENALTY_SECONDS,
    );
    expect(MAX_AUTH_PENALTY_SECONDS).toBeLessThanOrEqual(60);
  });

  it("the ceiling HOLDS under sustained failure, not just on the first 429", async () => {
    // Mutation found this. Reading Retry-After off the FIRST 429 proves
    // nothing: the first penalty is one second whether or not a cap exists.
    // The cap only matters after the doubling has had time to run away, which
    // is exactly the case that would lock the operator out for hours.
    jest.useFakeTimers();
    try {
      const proxy = await loadProxy();
      let worst = 0;
      for (let i = 0; i < 30; i++) {
        const res = proxy(bearer(WRONG));
        if (res.status === 429) {
          worst = Math.max(worst, Number(res.headers.get("retry-after")));
          // Step past the current penalty so the next attempt is counted and
          // the doubling continues, rather than bouncing off the same window.
          jest.advanceTimersByTime((MAX_AUTH_PENALTY_SECONDS + 1) * 1000);
        }
      }

      expect(worst).toBeGreaterThan(0);
      expect(worst).toBeLessThanOrEqual(MAX_AUTH_PENALTY_SECONDS);
    } finally {
      jest.useRealTimers();
    }
  });

  it("a correct token works again the moment the penalty elapses", async () => {
    jest.useFakeTimers();
    try {
      const proxy = await loadProxy();
      for (let i = 0; i < 40; i++) proxy(bearer(WRONG));
      expect(proxy(bearer(TOKEN)).status).toBe(429);

      jest.advanceTimersByTime((MAX_AUTH_PENALTY_SECONDS + 1) * 1000);

      const after = proxy(bearer(TOKEN));
      expect(after.status).not.toBe(429);
      expect(after.status).not.toBe(401);
    } finally {
      jest.useRealTimers();
    }
  });

  it("a success clears the record, so the next typo starts from zero", async () => {
    const proxy = await loadProxy();

    jest.useFakeTimers();
    try {
      for (let i = 0; i < 40; i++) proxy(bearer(WRONG));
      jest.advanceTimersByTime((MAX_AUTH_PENALTY_SECONDS + 1) * 1000);
      expect(proxy(bearer(TOKEN)).status).not.toBe(429);

      // Back to full speed: the counter was CLEARED, not merely paused. The
      // whole free budget has to be available again, because asserting only
      // the next single failure is a 401 passes even when nothing was cleared
      // -- the penalty window had already expired on the clock. Mutation found
      // exactly that.
      for (let i = 0; i < FREE_AUTH_ATTEMPTS; i++) {
        expect(proxy(bearer(WRONG)).status).toBe(401);
      }
    } finally {
      jest.useRealTimers();
    }
  });

  it("one client's failures do not throttle another", async () => {
    // Keyed per client. A shared counter would let anyone who can reach the
    // port lock everyone else out by failing on purpose.
    const proxy = await loadProxy();

    for (let i = 0; i < 40; i++) proxy(bearer(WRONG, "10.0.0.5"));

    expect(proxy(bearer(TOKEN, "10.0.0.9")).status).not.toBe(429);
  });
});

describe("GREEN CONTROLS: the boundary is otherwise unchanged", () => {
  it("a valid bearer is still allowed on the first request", async () => {
    const proxy = await loadProxy();

    expect(proxy(bearer(TOKEN)).status).not.toBe(401);
  });

  it("a public path is still public", async () => {
    const proxy = await loadProxy();

    expect(proxy(req("http://localhost:4242/api/health")).status).not.toBe(401);
  });

  it("no token at all is still 401, not 429", async () => {
    // Absent and wrong are different: a browser arriving with no cookie yet is
    // the normal first visit, and the sign-in page is the answer to it.
    const proxy = await loadProxy();

    expect(proxy(req("http://localhost:4242/api/sessions")).status).toBe(401);
  });

  it("a browser that keeps arriving without a cookie is never throttled", async () => {
    // Mutation found this. Asserting ONE credential-less request is a 401
    // proves nothing -- the first few failures are free anyway. A browser
    // polling a page it is not signed into does this dozens of times, and
    // counting it would lock the operator out of their own sign-in page.
    const proxy = await loadProxy();

    for (let i = 0; i < 20; i++) {
      expect(proxy(req("http://localhost:4242/api/sessions")).status).toBe(401);
    }
  });

  it("does not grow a record for every client that ever failed", async () => {
    // The other resource question. An attacker controls x-forwarded-for, so an
    // unpruned map is an unbounded allocation they can drive. Records for
    // clients that have stopped failing are forgotten.
    jest.useFakeTimers();
    try {
      const proxy = await loadProxy();
      const { authThrottleRecordCount } = await import("@/lib/auth-throttle");

      for (let i = 0; i < 50; i++) proxy(bearer(WRONG, `10.0.0.${i}`));
      expect(authThrottleRecordCount()).toBeGreaterThan(10);

      jest.advanceTimersByTime(20 * 60_000);
      proxy(bearer(WRONG, "10.0.1.1"));

      expect(authThrottleRecordCount()).toBeLessThanOrEqual(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it("auth mode none is untouched", async () => {
    process.env.PS_AUTH_MODE = "none";
    const proxy = await loadProxy();

    for (let i = 0; i < 40; i++) proxy(bearer(WRONG));

    expect(proxy(bearer(WRONG)).status).not.toBe(429);
    delete process.env.PS_AUTH_MODE;
  });
});
