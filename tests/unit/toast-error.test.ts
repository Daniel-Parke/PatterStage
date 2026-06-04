/**
 * Unit tests for `toastError` from src/lib/api-fetch.ts.
 *
 * `toastError(showToast, err, fallback)` is the canonical replacement for
 * the
 *   showToast(messageFromError(err, fallback), "error")
 * pattern. It composes `messageFromError()` with the `"error"` toast type
 * to close the 4-line `showToast(...)` catch block down to 1 line.
 *
 * Byte-equivalent to the inline form: same `messageFromError` semantics
 * (falls back to `fallback` when the error has no message), same
 * `"error"` toast type, same call to `showToast`.
 */
import { toastError } from "@/lib/api-fetch";

describe("toastError", () => {
  it("calls showToast with err.message and type 'error' for a normal Error", () => {
    const calls: Array<[string, string | undefined]> = [];
    const showToast = (message: string, type?: "success" | "error" | "info") => {
      calls.push([message, type]);
    };
    toastError(showToast, new Error("boom"), "fallback");
    expect(calls).toEqual([["boom", "error"]]);
  });

  it("calls showToast with the String() form for a thrown string", () => {
    const calls: Array<[string, string | undefined]> = [];
    const showToast = (message: string, type?: "success" | "error" | "info") => {
      calls.push([message, type]);
    };
    toastError(showToast, "plain string", "fallback");
    // toError wraps "plain string" in new Error("plain string"), so the
    // message is the string itself, not the fallback.
    expect(calls).toEqual([["plain string", "error"]]);
  });

  it("calls showToast with the fallback for an empty Error (the inline-pattern bug)", () => {
    const calls: Array<[string, string | undefined]> = [];
    const showToast = (message: string, type?: "success" | "error" | "info") => {
      calls.push([message, type]);
    };
    // The inline form would have called showToast("", "error") here.
    toastError(showToast, new Error(""), "Delete failed");
    expect(calls).toEqual([["Delete failed", "error"]]);
  });

  it("calls showToast with the fallback for null", () => {
    const calls: Array<[string, string | undefined]> = [];
    const showToast = (message: string, type?: "success" | "error" | "info") => {
      calls.push([message, type]);
    };
    // toError(null) = new Error("null") → message "null" (truthy) — wrapper case.
    toastError(showToast, null, "fallback");
    expect(calls).toEqual([["null", "error"]]);
  });

  it("calls showToast with the fallback for undefined", () => {
    const calls: Array<[string, string | undefined]> = [];
    const showToast = (message: string, type?: "success" | "error" | "info") => {
      calls.push([message, type]);
    };
    // toError(undefined) = new Error("undefined") → message "undefined".
    toastError(showToast, undefined, "fallback");
    expect(calls).toEqual([["undefined", "error"]]);
  });

  it("always uses 'error' toast type, never 'success' or 'info'", () => {
    const calls: Array<[string, string | undefined]> = [];
    const showToast = (message: string, type?: "success" | "error" | "info") => {
      calls.push([message, type]);
    };
    toastError(showToast, new Error("a"), "f1");
    toastError(showToast, "b", "f2");
    toastError(showToast, null, "f3");
    expect(calls.every(([, type]) => type === "error")).toBe(true);
  });

  it("composes with messageFromError — error message wins when non-empty", () => {
    const calls: Array<[string, string | undefined]> = [];
    const showToast = (message: string, type?: "success" | "error" | "info") => {
      calls.push([message, type]);
    };
    toastError(showToast, new Error("real reason"), "ignored");
    expect(calls).toEqual([["real reason", "error"]]);
  });

  it("preserves custom Error subclasses", () => {
    const calls: Array<[string, string | undefined]> = [];
    const showToast = (message: string, type?: "success" | "error" | "info") => {
      calls.push([message, type]);
    };
    toastError(showToast, new TypeError("bad type"), "f");
    expect(calls).toEqual([["bad type", "error"]]);
  });
});
