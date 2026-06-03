/**
 * Unit tests for `setErrorFromCaught` from src/lib/api-fetch.ts.
 *
 * `setErrorFromCaught(setError, err, fallback)` is the canonical replacement
 * for the
 *   setError(messageFromError(err, fallback))
 * pattern. It composes `messageFromError()` with the `setError` setter
 * to close the catch block down to a single call — the same byte-equivalent
 * as the inline form.
 *
 * This is the `setError` sibling of `toastError` (tests in toast-error.test.ts).
 * Same composition rules, different consumer (useState setter instead of
 * showToast). Tests mirror toast-error.test.ts to keep parity.
 */
import { setErrorFromCaught } from "@/lib/api-fetch";

describe("setErrorFromCaught", () => {
  it("calls setError with err.message for a normal Error", () => {
    const calls: Array<string | null> = [];
    const setError = (value: string | null) => {
      calls.push(value);
    };
    setErrorFromCaught(setError, new Error("boom"), "fallback");
    expect(calls).toEqual(["boom"]);
  });

  it("calls setError with the String() form for a thrown string", () => {
    const calls: Array<string | null> = [];
    const setError = (value: string | null) => {
      calls.push(value);
    };
    setErrorFromCaught(setError, "plain string", "fallback");
    // toError wraps "plain string" in new Error("plain string"), so the
    // message is the string itself, not the fallback.
    expect(calls).toEqual(["plain string"]);
  });

  it("calls setError with the fallback for an empty Error", () => {
    const calls: Array<string | null> = [];
    const setError = (value: string | null) => {
      calls.push(value);
    };
    setErrorFromCaught(setError, new Error(""), "Save failed");
    expect(calls).toEqual(["Save failed"]);
  });

  it("calls setError with the wrapper-message for null", () => {
    const calls: Array<string | null> = [];
    const setError = (value: string | null) => {
      calls.push(value);
    };
    // toError(null) = new Error("null") → message "null" (truthy).
    setErrorFromCaught(setError, null, "fallback");
    expect(calls).toEqual(["null"]);
  });

  it("calls setError with the wrapper-message for undefined", () => {
    const calls: Array<string | null> = [];
    const setError = (value: string | null) => {
      calls.push(value);
    };
    setErrorFromCaught(setError, undefined, "fallback");
    expect(calls).toEqual(["undefined"]);
  });

  it("composes with messageFromError — error message wins when non-empty", () => {
    const calls: Array<string | null> = [];
    const setError = (value: string | null) => {
      calls.push(value);
    };
    setErrorFromCaught(setError, new Error("real reason"), "ignored");
    expect(calls).toEqual(["real reason"]);
  });

  it("preserves custom Error subclasses", () => {
    const calls: Array<string | null> = [];
    const setError = (value: string | null) => {
      calls.push(value);
    };
    setErrorFromCaught(setError, new TypeError("bad type"), "f");
    expect(calls).toEqual(["bad type"]);
  });

  it("is byte-equivalent to setError(messageFromError(err, fallback))", async () => {
    // The "byte-equivalent to the inline form" guarantee. Import
    // messageFromError and verify that for the same inputs both code
    // paths produce the same setError call.
    const { messageFromError } = await import("@/lib/api-fetch");
    const inputs: Array<[unknown, string]> = [
      [new Error("a"), "f1"],
      [new Error(""), "f2"],
      ["plain string", "f3"],
      [null, "f4"],
      [undefined, "f5"],
      [new TypeError("z"), "f6"],
    ];
    for (const [err, fallback] of inputs) {
      const directCalls: Array<string | null> = [];
      const helperCalls: Array<string | null> = [];
      const directSetError = (v: string | null) => directCalls.push(v);
      const helperSetError = (v: string | null) => helperCalls.push(v);
      directSetError(messageFromError(err, fallback));
      setErrorFromCaught(helperSetError, err, fallback);
      expect(helperCalls).toEqual(directCalls);
    }
  });
});
