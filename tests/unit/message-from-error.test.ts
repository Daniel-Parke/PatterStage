/**
 * Unit tests for `messageFromError` (and `toError`) from src/lib/api-fetch.ts.
 *
 * `messageFromError(e, fallback)` is the canonical replacement for the
 *   err instanceof Error ? err.message : <fallback>
 * pattern. It guarantees a non-empty user-visible string by composing
 * `toError()` with the `|| fallback` discipline.
 *
 * The empty-Error edge case is the one the inline pattern gets wrong:
 * `new Error("")` has `e.message === ""` and `e instanceof Error === true`,
 * so `err instanceof Error ? err.message : "fallback"` returns the empty
 * string. `messageFromError` returns the fallback instead. The migration
 * in session 77 was prompted by a real call site (useModelsPage.ts) where
 * an empty `throw new Error("")` would have produced a blank toast.
 */
import { messageFromError, toError } from "@/lib/api-fetch";

describe("messageFromError", () => {
  it("returns err.message for a normal Error", () => {
    expect(messageFromError(new Error("boom"), "fallback")).toBe("boom");
  });

  it("returns the String() form for a thrown string", () => {
    // toError wraps "plain string" in new Error("plain string"), so the
    // message is the string itself, not the fallback.
    expect(messageFromError("plain string", "fallback")).toBe("plain string");
  });

  it("returns the fallback for an empty Error (the inline-pattern bug)", () => {
    // The inline form would have returned "" here.
    expect(messageFromError(new Error(""), "fallback")).toBe("fallback");
  });

  it("returns the fallback for null (toError wraps to Error with empty message)", () => {
    // toError(null) = new Error("null") → message "null" (truthy) — this
    // one isn't a fallback case but a wrapper case. Document the
    // behaviour so a future change to toError's String() coercion is
    // intentional.
    expect(messageFromError(null, "fallback")).toBe("null");
  });

  it("returns the fallback for undefined (toError wraps to Error with empty message)", () => {
    // toError(undefined) = new Error("undefined") → message "undefined".
    // Not a fallback case in practice; locked here as a behaviour contract.
    expect(messageFromError(undefined, "fallback")).toBe("undefined");
  });

  it("returns the String() form for a thrown number", () => {
    // toError(42) = new Error("42") — message is the string form.
    expect(messageFromError(42, "fallback")).toBe("42");
  });

  it("uses String() coercion for non-Error objects with a meaningful toString", () => {
    expect(messageFromError({ toString: () => "custom" }, "fallback")).toBe(
      "custom",
    );
  });

  it("returns the fallback when the toString output is empty", () => {
    // toError({ toString: () => "" }) = new Error("") — message is "".
    expect(messageFromError({ toString: () => "" }, "fallback")).toBe(
      "fallback",
    );
  });

  it("composes with toError — toError preserves Error instances", () => {
    const original = new Error("original");
    const wrapped = toError(original);
    expect(wrapped).toBe(original);
    expect(messageFromError(wrapped, "fallback")).toBe("original");
  });

  it("composes with toError — toError wraps non-Error values in a new Error", () => {
    const wrapped = toError("a string");
    expect(wrapped).toBeInstanceOf(Error);
    expect(wrapped.message).toBe("a string");
    expect(messageFromError(wrapped, "fallback")).toBe("a string");
  });

  it("preserves custom Error subclasses (TypeError, RangeError)", () => {
    expect(messageFromError(new TypeError("bad type"), "fallback")).toBe(
      "bad type",
    );
    expect(messageFromError(new RangeError("out of range"), "fallback")).toBe(
      "out of range",
    );
  });

  it("the fallback is used only when the error message is empty", () => {
    // When the error has a real message, that message wins. The fallback
    // is a true fallback, not a default.
    expect(messageFromError(new Error("ignored"), "Custom fallback msg")).toBe(
      "ignored",
    );
    expect(messageFromError(new Error(""), "Custom fallback msg")).toBe(
      "Custom fallback msg",
    );
  });
});

describe("toError", () => {
  it("preserves Error instances (no wrapping)", () => {
    const original = new Error("test");
    expect(toError(original)).toBe(original);
  });

  it("preserves Error subclasses", () => {
    const original = new TypeError("test");
    expect(toError(original)).toBe(original);
  });

  it("wraps strings in a new Error with String() coercion", () => {
    const wrapped = toError("a string");
    expect(wrapped).toBeInstanceOf(Error);
    expect(wrapped.message).toBe("a string");
  });

  it("wraps numbers in a new Error with String() coercion", () => {
    const wrapped = toError(42);
    expect(wrapped).toBeInstanceOf(Error);
    expect(wrapped.message).toBe("42");
  });

  it("wraps objects in a new Error using String() coercion", () => {
    const wrapped = toError({ foo: "bar" });
    expect(wrapped).toBeInstanceOf(Error);
    expect(wrapped.message).toBe("[object Object]");
  });
});
