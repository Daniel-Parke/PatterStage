/**
 * run-mutation — unit tests for the Hindsight mutation helper
 *
 * Locks down the busy/try/catch/finally + toast sequence so a future
 * refactor that drops a `finally setBusy(false)` is caught. The
 * session-35 + session-57 findings both flagged "forgot the finally"
 * bugs in unrelated handlers; runMutation consolidates the shape
 * into one helper, and this suite is the regression net.
 */

import { runMutation, type BusySetter } from "@/lib/run-mutation";

describe("run-mutation: happy path", () => {
  it("toasts success, calls build(), sets busy true→false, runs onSuccess", async () => {
    const showToast = jest.fn();
    const busy = jest.fn() as unknown as BusySetter;
    let busyState = false;
    const realBusy: BusySetter = (v) => {
      busyState = typeof v === "function" ? (v as (p: boolean) => boolean)(busyState) : v;
      busy(v);
    };

    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const onSuccess = jest.fn(async () => undefined);
    const onSuccessResult = jest.fn();

    const ok = await runMutation(showToast, {
      busy: realBusy,
      build: () => ({ action: "noop" }),
      path: "/api/memory/hindsight",
      successMsg: "saved",
      errorMsg: "save failed",
      onSuccess,
      onSuccessResult,
    });

    expect(ok).toBe(true);
    expect(busy).toHaveBeenNthCalledWith(1, true);
    expect(busy).toHaveBeenLastCalledWith(false);
    expect(showToast).toHaveBeenCalledWith("saved", "success");
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccessResult).toHaveBeenCalledTimes(1);
    expect(busyState).toBe(false); // finally block ran
  });

  it("does not require onSuccess / onSuccessResult", async () => {
    const showToast = jest.fn();
    const busy = jest.fn() as unknown as BusySetter;

    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const ok = await runMutation(showToast, {
      busy,
      build: () => ({}),
      path: "/api/x",
      successMsg: "ok",
      errorMsg: "fail",
    });

    expect(ok).toBe(true);
    expect(busy).toHaveBeenNthCalledWith(1, true);
    expect(busy).toHaveBeenLastCalledWith(false);
  });
});

describe("run-mutation: isValid guard", () => {
  it("returns false and does not fire the request when isValid is false", async () => {
    const showToast = jest.fn();
    const busy = jest.fn() as unknown as BusySetter;
    const fetchSpy = jest.fn();

    global.fetch = fetchSpy as unknown as typeof fetch;

    const ok = await runMutation(showToast, {
      busy,
      isValid: () => false,
      build: jest.fn(() => ({})),
      path: "/api/x",
      successMsg: "ok",
      errorMsg: "fail",
    });

    expect(ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(busy).not.toHaveBeenCalled(); // guard short-circuits before busy is set
    expect(showToast).not.toHaveBeenCalled();
  });

  it("fires the request when isValid is true", async () => {
    const showToast = jest.fn();
    const busy = jest.fn() as unknown as BusySetter;

    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ data: {} }), { status: 200 }),
    );

    await runMutation(showToast, {
      busy,
      isValid: () => true,
      build: () => ({}),
      path: "/api/x",
      successMsg: "ok",
      errorMsg: "fail",
    });

    expect(busy).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("ok", "success");
  });

  it("defaults to 'valid' when isValid is omitted", async () => {
    const showToast = jest.fn();
    const busy = jest.fn() as unknown as BusySetter;

    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ data: {} }), { status: 200 }),
    );

    const ok = await runMutation(showToast, {
      busy,
      build: () => ({}),
      path: "/api/x",
      successMsg: "ok",
      errorMsg: "fail",
    });

    expect(ok).toBe(true);
  });
});

describe("run-mutation: error paths", () => {
  it("toasts the server error message when ok=false", async () => {
    const showToast = jest.fn();
    const busy = jest.fn() as unknown as BusySetter;

    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ error: "validation failed" }), { status: 400 }),
    );

    const ok = await runMutation(showToast, {
      busy,
      build: () => ({}),
      path: "/api/x",
      successMsg: "ok",
      errorMsg: "fallback",
    });

    expect(ok).toBe(false);
    expect(showToast).toHaveBeenCalledWith("validation failed", "error");
    expect(busy).toHaveBeenLastCalledWith(false);
  });

  it("prefers the server's error message over the fallback when both exist", async () => {
    // apiFetch converts a 500 with no error field to `error: "HTTP 500"`,
    // so the fallback in runMutation only fires when safeApiCall returns
    // ok:false with an empty error field — which is not currently
    // produced by the real apiFetch implementation. The fallback
    // message exists as a defence-in-depth for that path.
    const showToast = jest.fn();
    const busy = jest.fn() as unknown as BusySetter;

    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ error: "HTTP 500" }), { status: 500 }),
    );

    await runMutation(showToast, {
      busy,
      build: () => ({}),
      path: "/api/x",
      successMsg: "ok",
      errorMsg: "fallback",
    });

    // The server's "HTTP 500" wins over the fallback. This is the
    // common path in production — the fallback is only used if
    // safeApiCall ever returns an undefined error.
    expect(showToast).toHaveBeenCalledWith("HTTP 500", "error");
  });

  it("clears busy even when the response is !ok", async () => {
    // Lock down the finally-block behaviour for the !ok branch. The
    // session-35 + session-57 findings both flagged forgotten
    // `setBusy(false)` calls; this test is the regression net.
    const showToast = jest.fn();
    const busy = jest.fn() as unknown as BusySetter;

    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ error: "nope" }), { status: 400 }),
    );

    await runMutation(showToast, {
      busy,
      build: () => ({}),
      path: "/api/x",
      successMsg: "ok",
      errorMsg: "fail",
    });

    expect(busy).toHaveBeenNthCalledWith(1, true);
    expect(busy).toHaveBeenLastCalledWith(false);
  });
});

describe("run-mutation: onSuccess ordering", () => {
  it("runs onSuccess after the success toast", async () => {
    const order: string[] = [];
    const showToast = jest.fn((msg: string) => {
      order.push(`toast:${msg}`);
    });
    const busy = jest.fn() as unknown as BusySetter;

    global.fetch = jest.fn(async () => {
      order.push("fetch");
      return new Response(JSON.stringify({ data: {} }), { status: 200 });
    });

    await runMutation(showToast, {
      busy,
      build: () => ({}),
      path: "/api/x",
      successMsg: "ok",
      errorMsg: "fail",
      onSuccess: () => {
        order.push("onSuccess");
      },
    });

    // onSuccess runs AFTER the success toast, AFTER the fetch resolved
    expect(order).toEqual(["fetch", "toast:ok", "onSuccess"]);
  });

  it("does not run onSuccess when the response is !ok", async () => {
    const showToast = jest.fn();
    const busy = jest.fn() as unknown as BusySetter;
    const onSuccess = jest.fn();

    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ error: "nope" }), { status: 400 }),
    );

    await runMutation(showToast, {
      busy,
      build: () => ({}),
      path: "/api/x",
      successMsg: "ok",
      errorMsg: "fail",
      onSuccess,
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("awaits an async onSuccess before clearing busy", async () => {
    const showToast = jest.fn();
    const busy = jest.fn() as unknown as BusySetter;

    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ data: {} }), { status: 200 }),
    );

    let onSuccessCompleted = false;
    await runMutation(showToast, {
      busy,
      build: () => ({}),
      path: "/api/x",
      successMsg: "ok",
      errorMsg: "fail",
      onSuccess: async () => {
        await new Promise((r) => setTimeout(r, 5));
        onSuccessCompleted = true;
      },
    });

    expect(onSuccessCompleted).toBe(true);
    // busy(false) is the LAST call — even after an awaited onSuccess
    expect(busy).toHaveBeenLastCalledWith(false);
  });
});
