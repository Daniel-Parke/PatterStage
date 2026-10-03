// ═══════════════════════════════════════════════════════════════
// setField — Build a partial-update setter for a single key
// ═══════════════════════════════════════════════════════════════
//
// Type-safe at both ends: `setter` is a `Dispatch<SetStateAction<S>>` for
// the form shape `S`, and `key` is constrained to `keyof S`.

import type { Dispatch, SetStateAction } from "react";

/**
 * Build a single-key partial-update setter for a React form state.
 *
 * @param setter - The form's `setState` dispatch (from `useState`).
 * @param key - The field key to update.
 * @returns A function that accepts the new field value and updates
 *          the form with a partial-spread: `setForm(p => ({ ...p, [key]: v }))`.
 *
 * @example
 *   const [form, setForm] = useState({ name: "", content: "" });
 *   <input value={form.name} onChange={(e) => setField(setForm, "name")(e.target.value)} />
 *   <Modal onNameChange={setField(setForm, "name")} />
 */
export function setField<S>(
  setter: Dispatch<SetStateAction<S>>,
  key: keyof S,
): (value: S[keyof S]) => void {
  return (value: S[keyof S]) =>
    setter((prev) => ({ ...prev, [key]: value }) as S);
}
