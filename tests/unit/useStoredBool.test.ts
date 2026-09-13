/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { useStoredBool } from "@/hooks/useStoredBool";

describe("useStoredBool", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts with the default value before hydration", () => {
    // No localStorage entry → stays at default
    const { result } = renderHook(() =>
      useStoredBool("test-key", true),
    );
    expect(result.current[0]).toBe(true);
  });

  it("hydrates from localStorage after mount", async () => {
    window.localStorage.setItem("test-key", "true");
    const { result } = renderHook(() =>
      useStoredBool("test-key", false),
    );
    // Effect runs after mount; the stored "true" should win over the
    // default `false`.
    await waitFor(() => {
      expect(result.current[0]).toBe(true);
    });
  });

  it("hydrates 'false' from localStorage when default is true", async () => {
    window.localStorage.setItem("test-key", "false");
    const { result } = renderHook(() =>
      useStoredBool("test-key", true),
    );
    await waitFor(() => {
      expect(result.current[0]).toBe(false);
    });
  });

  it("the setter writes to localStorage", () => {
    const { result } = renderHook(() =>
      useStoredBool("test-key", false),
    );
    act(() => {
      result.current[1](true);
    });
    expect(result.current[0]).toBe(true);
    expect(window.localStorage.getItem("test-key")).toBe("true");
  });

  it("the setter writes 'false' to localStorage when set to false", () => {
    const { result } = renderHook(() =>
      useStoredBool("test-key", true),
    );
    act(() => {
      result.current[1](false);
    });
    expect(result.current[0]).toBe(false);
    expect(window.localStorage.getItem("test-key")).toBe("false");
  });

  it("survives localStorage being unavailable (private mode)", () => {
    // Override localStorage.getItem/setItem to throw, simulating
    // private-mode SecurityError / QuotaExceededError.
    const originalGetItem = window.localStorage.getItem;
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.getItem = jest.fn(() => {
      throw new Error("SecurityError");
    });
    window.localStorage.setItem = jest.fn(() => {
      throw new Error("QuotaExceededError");
    });

    const { result } = renderHook(() =>
      useStoredBool("test-key", true),
    );
    // Default value holds when localStorage is unavailable
    expect(result.current[0]).toBe(true);

    // Setter should also not throw
    expect(() => {
      act(() => {
        result.current[1](false);
      });
    }).not.toThrow();
    expect(result.current[0]).toBe(false);

    window.localStorage.getItem = originalGetItem;
    window.localStorage.setItem = originalSetItem;
  });

  it("migrates a value from the legacy key once, then removes it", async () => {
    window.localStorage.setItem("ch.legacy-key", "true");
    const { result } = renderHook(() =>
      useStoredBool("ps.new-key", false, "ch.legacy-key"),
    );
    await waitFor(() => {
      expect(result.current[0]).toBe(true);
    });
    // Value copied to the new key; the legacy key is cleaned up.
    expect(window.localStorage.getItem("ps.new-key")).toBe("true");
    expect(window.localStorage.getItem("ch.legacy-key")).toBeNull();
  });

  it("prefers the new key over the legacy key when both exist", async () => {
    window.localStorage.setItem("ps.new-key", "false");
    window.localStorage.setItem("ch.legacy-key", "true");
    const { result } = renderHook(() =>
      useStoredBool("ps.new-key", true, "ch.legacy-key"),
    );
    await waitFor(() => {
      expect(result.current[0]).toBe(false);
    });
    // Legacy key is left untouched (the new key already won).
    expect(window.localStorage.getItem("ch.legacy-key")).toBe("true");
  });

  it("ignores stored values that are not 'true' or 'false'", async () => {
    // The hook only acts on the literal strings "true"/"false". Any
    // other stored value is ignored and the default wins.
    window.localStorage.setItem("test-key", "yes-please");
    const { result } = renderHook(() =>
      useStoredBool("test-key", false),
    );
    // Effect runs and does nothing (doesn't match true/false).
    // Default of false should remain.
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current[0]).toBe(false);
  });
});
