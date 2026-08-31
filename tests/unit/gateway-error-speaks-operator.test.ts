/** @jest-environment node */

// T-0080 acceptance oracle — the gateway error stops being a Node string.
//
// THE DEFECT (QA finding 6, confirmed and sharpened by a browser pass). Send a
// chat turn with the gateway stopped and PatterStage stores, and renders,
//
//     fetch failed: connect ECONNREFUSED 127.0.0.1:8652
//
// That is undici talking to itself. It names an address the operator never
// typed, does not say what the address IS, and does not say what to do. It
// reaches SEVEN storage columns across six tables -- worst of them
// `missions.result`, where a Node transport string is presented as the outcome
// of the operator's work.
//
// THE SEAM. All seven read the error through `messageFromError`, which walks
// the cause chain. So the fix belongs at the two places the raw fetch actually
// happens -- `HermesRuntime.fetchJson` and `streamRunEvents` -- where
// `ep.baseUrl` is in scope and the address can be named as what it is. Fixing
// it there fixes all seven at once, and any eighth added later.
//
// AND THE BROWSER HALF (P0-4, P0-5). `GatewayBanner` hardcodes "port 8642" and
// said so while the gateway was on 8652, sending the operator to fix a port
// that was not the one that was down. Its actionable copy is also gated behind
// an EMPTY chat, so the operator most likely to need it -- mid-conversation,
// having just watched a turn fail -- is the one who cannot see it.

import { HermesRuntime } from "@/lib/runtime/HermesRuntime";
import { RuntimeRequestError } from "@/lib/runtime/types";
import type { RuntimeEndpoint } from "@/lib/runtime/endpoint-registry";
import { messageFromError } from "@/lib/api-fetch";
import { bannerStatesFor } from "@/components/chat/gateway-banner-states";

const endpoint: RuntimeEndpoint = {
  profileName: "default",
  baseUrl: "http://127.0.0.1:8652",
  apiKey: null,
};

/** Exactly what undici throws when nothing is listening: a wrapper over a cause. */
function connectionRefused(): TypeError {
  const cause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:8652"), {
    code: "ECONNREFUSED",
  });
  return Object.assign(new TypeError("fetch failed"), { cause });
}

function runtimeThatThrows(err: unknown): HermesRuntime {
  return new HermesRuntime({
    resolve: () => endpoint,
    fetchImpl: () => Promise.reject(err),
    timeoutMs: 30_000,
  });
}

async function caught(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
  } catch (e) {
    return e;
  }
  throw new Error("expected a rejection, got none");
}

describe("a stopped gateway is reported as a stopped gateway", () => {
  it("names the address it actually tried", async () => {
    // The whole complaint in one assertion. 8652 is where this instance's
    // gateway is configured; the operator has never seen 8642 and should not
    // be sent looking for it.
    const err = await caught(() => runtimeThatThrows(connectionRefused()).getRun("r1"));

    expect((err as Error).message).toContain("http://127.0.0.1:8652");
  });

  it("says what to do about it", async () => {
    const err = await caught(() => runtimeThatThrows(connectionRefused()).getRun("r1"));

    // Not merely "is not responding". A message an operator can act on names
    // the remedy; the chat banner has carried this sentence for months and the
    // stored error should not be less helpful than the banner.
    expect((err as Error).message).toMatch(/hermes gateway/i);
  });

  it("names the lever for a gateway that lives somewhere else", async () => {
    // The address is a default until someone overrides it. An operator running
    // a gateway on another port needs to know which variable moves it -- this
    // is the exact confusion boot-diagnostics.ts already exists to prevent.
    const err = await caught(() => runtimeThatThrows(connectionRefused()).getRun("r1"));

    expect((err as Error).message).toContain("HERMES_GATEWAY_URL");
  });

  it("does not hand the operator undici's own words", async () => {
    const err = await caught(() => runtimeThatThrows(connectionRefused()).getRun("r1"));

    // "fetch failed" is the wrapper, not the fact. Its presence is the defect.
    expect((err as Error).message).not.toMatch(/fetch failed/i);
  });

  it("survives the chain walk every storage site puts it through", async () => {
    // The seven write sites do not read `.message`; they read
    // `messageFromError`, which JOINS the cause chain with ": ". An otherwise
    // perfect message with the raw TypeError still attached as `cause` would
    // reach the column as "...: fetch failed: connect ECONNREFUSED ..." and the
    // defect would survive the fix. This is the assertion that pins that.
    const err = await caught(() => runtimeThatThrows(connectionRefused()).getRun("r1"));
    const stored = messageFromError(err, "run failed");

    expect(stored).toContain("http://127.0.0.1:8652");
    expect(stored).not.toMatch(/fetch failed/i);
  });

  it("still carries the transport code, because a diagnosis is not noise", async () => {
    // Readable is not the same as vague. ECONNREFUSED (nothing listening) and
    // ENOTFOUND (the name does not resolve) are different problems with
    // different fixes, and collapsing both into "not responding" would trade
    // one unhelpful message for another.
    const refused = await caught(() => runtimeThatThrows(connectionRefused()).getRun("r1"));
    expect((refused as Error).message).toContain("ECONNREFUSED");

    const dns = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("getaddrinfo ENOTFOUND gw.invalid"), { code: "ENOTFOUND" }),
    });
    const notFound = await caught(() => runtimeThatThrows(dns).getRun("r1"));
    expect((notFound as Error).message).toContain("ENOTFOUND");
  });
});

describe("the mapped error keeps the status contract the callers depend on", () => {
  it("is a RuntimeRequestError, so callers can read it as one", async () => {
    const err = await caught(() => runtimeThatThrows(connectionRefused()).getRun("r1"));
    expect(err).toBeInstanceOf(RuntimeRequestError);
  });

  it("is NOT 404, or reconcile fails every in-flight run instantly", async () => {
    // T-0078 gave the 404 branch a two-minute grace precisely because a
    // backend that has lost a run and a backend that is down are different
    // facts. Mapping a connection refusal onto 404 would route "the gateway is
    // off" into "the backend forgot this run" and fail the fleet in one tick.
    const err = await caught(() => runtimeThatThrows(connectionRefused()).getRun("r1"));
    expect((err as RuntimeRequestError).status).not.toBe(404);
  });

  it("is NOT 429, or submitRun retries a dead gateway four times", async () => {
    const err = await caught(() => runtimeThatThrows(connectionRefused()).getRun("r1"));
    expect((err as RuntimeRequestError).status).not.toBe(429);
  });
});

describe("a cancelled call is not a broken gateway", () => {
  it("re-throws the caller's abort untouched", async () => {
    // The trap in this change. `submitRun` takes the caller's AbortSignal, and
    // a cancelled mission aborts it mid-flight. An abort that arrives as a
    // rejected fetch looks exactly like a transport failure -- and reporting a
    // deliberate cancel as "the gateway is not responding" would recreate,
    // through the back door, the defect class T-0069 spent a whole task
    // removing: a decision rendered as a crash.
    const ctrl = new AbortController();
    ctrl.abort();
    const abortErr = Object.assign(new Error("This operation was aborted"), {
      name: "AbortError",
    });

    const runtime = new HermesRuntime({
      resolve: () => endpoint,
      fetchImpl: () => Promise.reject(abortErr),
    });

    const err = await caught(() =>
      runtime.submitRun({ input: "hi", signal: ctrl.signal } as never),
    );

    expect((err as Error).message).not.toMatch(/not responding/i);
    expect(err).not.toBeInstanceOf(RuntimeRequestError);
  });

  it("but OUR OWN deadline is reported as ours, with the budget that fired", async () => {
    // The other half: nobody cancelled this, we gave up. Saying so -- and
    // saying after how long -- is the difference between a bug report and a
    // shrug.
    const timeout = Object.assign(new Error("The operation was aborted due to timeout"), {
      name: "TimeoutError",
    });
    const runtime = new HermesRuntime({
      resolve: () => endpoint,
      fetchImpl: () => Promise.reject(timeout),
      timeoutMs: 30_000,
    });

    const err = await caught(() => runtime.getRun("r1"));

    expect((err as Error).message).toContain("http://127.0.0.1:8652");
    expect((err as Error).message).toMatch(/30s/);
  });
});

describe("the streaming site gets the same treatment", () => {
  it("names the gateway when the event stream cannot connect", async () => {
    // The second raw fetch in the file, and the one behind the live chat
    // spinner. It had the same `ep.baseUrl` in scope and the same nothing done
    // with it.
    const runtime = runtimeThatThrows(connectionRefused());

    const err = await caught(async () => {
      for await (const evt of runtime.streamRunEvents("r1")) void evt;
    });

    expect((err as Error).message).toContain("http://127.0.0.1:8652");
    expect((err as Error).message).not.toMatch(/fetch failed/i);
  });
});

describe("GREEN CONTROLS: a gateway that answers is untouched", () => {
  it("a 404 from a live gateway is still a 404 with its detail", async () => {
    const runtime = new HermesRuntime({
      resolve: () => endpoint,
      fetchImpl: () =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
          text: async () => "no such run",
          json: async () => ({}),
        } as unknown as Response),
    });

    const err = await caught(() => runtime.getRun("r1"));

    expect((err as RuntimeRequestError).status).toBe(404);
    expect((err as Error).message).toContain("no such run");
  });

  it("a successful call is not rewritten", async () => {
    const runtime = new HermesRuntime({
      resolve: () => endpoint,
      fetchImpl: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ run_id: "r1", status: "completed", output: "done" }),
        } as unknown as Response),
    });

    await expect(runtime.getRun("r1")).resolves.toMatchObject({ status: "completed" });
  });

  it("a 429 still surfaces as 429, so the backoff still engages", async () => {
    const runtime = new HermesRuntime({
      resolve: () => endpoint,
      fetchImpl: () =>
        Promise.resolve({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          text: async () => "busy",
          json: async () => ({}),
        } as unknown as Response),
    });

    const err = await caught(() => runtime.getRun("r1"));
    expect((err as RuntimeRequestError).status).toBe(429);
  });
});

describe("the banner shows up where it is needed (P0-5)", () => {
  const live = {
    gatewayOnline: false as boolean | null,
    gatewayAuthConfigured: null as boolean | null,
    agentDefaultModelSet: true as boolean | null,
    hasActiveConversation: true,
    messageCount: 6,
  };

  it("renders offline mid-conversation, not only on an empty chat", () => {
    // The state that most needs the copy is the one that could not show it: a
    // turn has just failed, and the sentence explaining how to fix it was
    // gated behind having no conversation at all.
    expect(bannerStatesFor(live)).toContain("offline");
  });

  it("renders the auth failure mid-conversation too", () => {
    expect(
      bannerStatesFor({ ...live, gatewayOnline: true, gatewayAuthConfigured: false }),
    ).toContain("auth-missing");
  });

  it("does NOT nag mid-conversation about advisory state", () => {
    // The other half of the ruling, and the reason this is not simply
    // "ungate everything". `model-missing` is configuration advice and
    // `checking` is a spinner; neither blocks the send, and a banner that
    // appears above a working conversation every 30 seconds is noise that
    // teaches the operator to ignore banners -- including the two that matter.
    const states = bannerStatesFor({
      ...live,
      gatewayOnline: true,
      gatewayAuthConfigured: true,
      agentDefaultModelSet: false,
    });
    expect(states).not.toContain("model-missing");

    expect(bannerStatesFor({ ...live, gatewayOnline: null })).not.toContain("checking");
  });

  it("GREEN CONTROL: an empty chat still gets the full advisory set", () => {
    const empty = { ...live, hasActiveConversation: false, messageCount: 0 };

    expect(bannerStatesFor({ ...empty, gatewayOnline: null })).toEqual(["checking"]);
    expect(
      bannerStatesFor({
        ...empty,
        gatewayOnline: true,
        gatewayAuthConfigured: true,
        agentDefaultModelSet: false,
      }),
    ).toEqual(["model-missing"]);
  });

  it("GREEN CONTROL: a healthy gateway shows nothing at all", () => {
    expect(
      bannerStatesFor({
        gatewayOnline: true,
        gatewayAuthConfigured: true,
        agentDefaultModelSet: true,
        hasActiveConversation: false,
        messageCount: 0,
      }),
    ).toEqual([]);
  });

  it("never shows offline and auth-missing at once", () => {
    // They are contradictory readings of the same probe: one says nothing
    // answered, the other says something answered and refused us.
    const states = bannerStatesFor({ ...live, gatewayOnline: false, gatewayAuthConfigured: false });
    expect(states).not.toEqual(expect.arrayContaining(["offline", "auth-missing"]));
  });
});
