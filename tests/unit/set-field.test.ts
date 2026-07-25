/**
 * Unit tests for the `setField` helper (src/lib/set-field.ts).
 *
 * `setField(setter, key)` builds a `(value) => void` that updates a
 * single field of a React form via the partial-spread updater
 * pattern. The helper is currently consumed 14 times by
 * HindsightBrowser.tsx (4 sites each in the create + edit modals for
 * directives and mental-models) but is also used wherever a form
 * has several `<input>` controls backed by `useState`.
 *
 * The test locks down:
 *   - The return value is a function that takes the new value
 *   - The setter calls the underlying `Dispatch<SetStateAction<S>>`
 *     with a functional updater that spreads + overwrites the key
 *   - Type-safety: when `S` is `{ a: string, b: number }`, only
 *     "a" and "b" are accepted as keys
 *   - Idempotence: calling the same setter twice with the same
 *     value produces the same end state
 *   - Multiple keys: two `setField` setters built for different
 *     keys of the same form don't collide
 */
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";

import { setField } from "@/lib/set-field";

describe("setField", () => {
  it("returns a function that takes the new value", () => {
    const setter = jest.fn();
    const result = setField(setter, "name");
    expect(typeof result).toBe("function");
    result("alice");
    expect(setter).toHaveBeenCalledTimes(1);
  });

  it("calls the underlying setter with a functional updater (partial-spread)", () => {
    const setter = jest.fn();
    const result = setField<{ name: string; age: number }>(setter, "name");
    result("alice");
    // The first arg should be a function (functional updater)
    const updater = setter.mock.calls[0][0];
    expect(typeof updater).toBe("function");
    // Apply the updater to a prior state and assert the partial-spread
    expect(updater({ name: "bob", age: 30 })).toEqual({ name: "alice", age: 30 });
  });

  it("preserves other fields when updating one", () => {
    const setter = jest.fn();
    const result = setField<{ name: string; age: number; tags: string }>(setter, "age");
    result(42);
    const updater = setter.mock.calls[0][0];
    expect(updater({ name: "alice", age: 0, tags: "x" })).toEqual({
      name: "alice",
      age: 42,
      tags: "x",
    });
  });

  it("is idempotent when called twice with the same value", () => {
    const setter = jest.fn();
    const result = setField<{ name: string }>(setter, "name");
    result("alice");
    result("alice");
    const updater1 = setter.mock.calls[0][0];
    const updater2 = setter.mock.calls[1][0];
    const start = { name: "bob" };
    expect(updater2(updater1(start))).toEqual(updater1(start));
  });

  it("integrates with React useState — sets the field", () => {
    const { result } = renderHook(() => {
      const [form, setForm] = useState({ name: "", age: 0 });
      return { form, setForm, setName: setField(setForm, "name") };
    });

    expect(result.current.form).toEqual({ name: "", age: 0 });
    act(() => {
      result.current.setName("alice");
    });
    expect(result.current.form).toEqual({ name: "alice", age: 0 });
  });

  it("integrates with React useState — two setField setters don't collide", () => {
    const { result } = renderHook(() => {
      const [form, setForm] = useState({ name: "", age: 0 });
      return {
        form,
        setName: setField(setForm, "name"),
        setAge: setField(setForm, "age"),
      };
    });

    act(() => {
      result.current.setName("alice");
    });
    act(() => {
      result.current.setAge(30);
    });

    expect(result.current.form).toEqual({ name: "alice", age: 30 });
  });

  it("supports different value types per key (string + number + boolean)", () => {
    type Form = { name: string; age: number; active: boolean };
    const setter = jest.fn();
    const setName = setField<Form>(setter, "name");
    const setAge = setField<Form>(setter, "age");
    const setActive = setField<Form>(setter, "active");

    setName("alice");
    setAge(30);
    setActive(true);

    // 3 setter calls
    expect(setter).toHaveBeenCalledTimes(3);
    // Each carries the right value when applied
    const start: Form = { name: "", age: 0, active: false };
    const after1 = setter.mock.calls[0][0](start);
    const after2 = setter.mock.calls[1][0](after1);
    const after3 = setter.mock.calls[2][0](after2);
    expect(after3).toEqual({ name: "alice", age: 30, active: true });
  });

  it("rejects a key not in the form shape (compile-time check)", () => {
    // This is a type-level test, not a runtime one. The @ts-expect-error
    // comments below document that `setField` accepts only `keyof S`.
    // If a future refactor weakens the type, the lines below stop
    // erroring and the @ts-expect-error comments start erroring.
    type Form = { name: string };
    const setter = jest.fn();

    // Valid: "name" is in Form
    setField<Form>(setter, "name")("alice");
    // @ts-expect-error — "missing" is not in Form
    setField<Form>(setter, "missing");
    // The test simply asserts the valid call was recorded; the
    // ts-expect-error comments above are the type-level assertion.
    // (Do NOT let a prose line begin with the directive spelling: TypeScript
    // reads it as a real directive and silently suppresses the next line.)
    expect(setter).toHaveBeenCalledTimes(1);
  });
});
