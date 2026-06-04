// ═══════════════════════════════════════════════════════════════
// setField — Build a partial-update setter for a single key
// ═══════════════════════════════════════════════════════════════
//
// React forms with several `<input>` controls end up with a 3-4 line
// `onChange` handler per field:
//
//   const [form, setForm] = useState({ name: "", content: "", priority: "0" });
//   <input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
//   <input value={form.content} onChange={(e) => setForm(p => ({ ...p, content: e.target.value }))} />
//   <input value={form.priority} onChange={(e) => setForm(p => ({ ...p, priority: e.target.value }))} />
//
// `setField` collapses each per-field handler to a one-liner that
// returns a `(value) => void` matching the standard input
// `onChange` contract:
//
//   <input value={form.name} onChange={(e) => setField(setForm, "name")(e.target.value)} />
//   <input value={form.name} onChange={setField(setForm, "name")} />     // when the event value matches
//
// The returned setter preserves the original updater semantics
// (functional update with a partial) and is type-safe at both
// ends: `setter` is a `Dispatch<SetStateAction<S>>` for the form
// shape `S`, and `key` is constrained to `keyof S`.
//
// Note: when the field's "value" type is identical to the event's
// value (e.g. `<input value={form.priority} onChange={(e) => setForm(...)}>`),
// the consumer can pass the event directly:
//
//   <input onChange={(e) => setField(setForm, "priority")(e.target.value)} />
//
// But the common shape is the 1-arg `setField(setForm, "name")`
// form, which the HindsightBrowser uses 14 times.

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
 *   <input
 *     value={form.name}
 *     onChange={(e) => setField(setForm, "name")(e.target.value)}
 *   />
 *   // Or, if the modal exposes onNameChange / onContentChange props
 *   // that take the value directly:
 *   <Modal
 *     onNameChange={setField(setForm, "name")}
 *     onContentChange={setField(setForm, "content")}
 *   />
 */
export function setField<S>(
  setter: Dispatch<SetStateAction<S>>,
  key: keyof S,
): (value: S[keyof S]) => void {
  return (value: S[keyof S]) =>
    setter((prev) => ({ ...prev, [key]: value }) as S);
}
