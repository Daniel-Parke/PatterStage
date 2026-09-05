// ═══════════════════════════════════════════════════════════════
// useStoredBool — Boolean state synced to localStorage
// ═══════════════════════════════════════════════════════════════
//
// Pages with persistent UI toggles (e.g. the Sessions page's
// "group by mission" and "hide API noise" switches) had a 25-line
// `useStoredBool` hook inlined in the page file. The pattern is
// universally useful — any user preference toggle that should
// survive a page reload — so it's extracted to its own module.
//
// Behaviour:
//   1. Initial render uses `defaultValue` to avoid SSR hydration
//      mismatches (localStorage isn't available on the server).
//   2. After mount, the value is hydrated from `localStorage[key]`
//      if present (parses the literal "true"/"false" string).
//   3. Updates write through to localStorage. localStorage may be
//      unavailable (private mode, quota errors) — both reads and
//      writes are wrapped in try/catch and silently fall back to
//      in-memory state.

"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A boolean state value that is hydrated from, and written to,
 * `localStorage` under the given key.
 *
 * @param key          - localStorage key
 * @param defaultValue - initial value before hydration (and the
 *                       fallback if localStorage is unavailable)
 */
export function useStoredBool(
  key: string,
  defaultValue: boolean,
  /**
   * Optional legacy key to migrate from. When `key` is absent but `legacyKey`
   * holds a value, it's copied to `key` once and the legacy key is removed —
   * so renaming a storage key (e.g. the `ch.*` → `ps.*` sweep) doesn't lose the
   * user's saved preference.
   */
  legacyKey?: string,
): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(defaultValue);

  // Hydrate from localStorage after mount to avoid SSR hydration mismatches
  useEffect(() => {
    try {
      let raw = window.localStorage.getItem(key);
      if (raw === null && legacyKey) {
        const legacy = window.localStorage.getItem(legacyKey);
        if (legacy !== null) {
          window.localStorage.setItem(key, legacy);
          window.localStorage.removeItem(legacyKey);
          raw = legacy;
        }
      }
      if (raw === "true") setValue(true);
      else if (raw === "false") setValue(false);
    } catch {
      // localStorage may be unavailable (private mode, etc.) — keep default
    }
  }, [key, legacyKey]);

  const update = useCallback(
    (v: boolean) => {
      setValue(v);
      try {
        window.localStorage.setItem(key, v ? "true" : "false");
      } catch {
        // ignore quota / private-mode errors
      }
    },
    [key],
  );

  return [value, update];
}
