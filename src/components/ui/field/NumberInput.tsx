"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Field } from "./Field";
import { Input as FieldInput } from "./Input";

/**
 * A number field that says what it will accept, and answers `null` for empty.
 *
 * It used to be `onChange(Number(e.target.value))` over the prop directly, so
 * an emptied box emitted 0 and a half-typed "-" emitted NaN, and the declared
 * min/max were decoration on an input nothing enforced (T-0100, D77/D78).
 *
 * The text is local state, because a controlled number cannot represent
 * "1." on the way to "1.5". The prop is copied back in only when it changes to
 * something this input did not emit, so a parent that resets the form wins and
 * a keystroke round-tripping through the parent does not fight the caret.
 */
export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  description,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  description?: string;
}) {
  const asText = (v: number | null | undefined) =>
    v === null || v === undefined || !Number.isFinite(v) ? "" : String(v);
  const [raw, setRaw] = useState(() => asText(value));
  const emitted = useRef<number | null>(value ?? null);
  const inputId = useId();
  const problemId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const next = value ?? null;
    if (next !== emitted.current) {
      emitted.current = next;
      setRaw(asText(next));
    }
    // Only the prop: `raw` is this input's own business between renders.
  }, [value]);

  const emit = (v: number | null) => {
    emitted.current = v;
    onChange(v);
  };

  const parsed = raw.trim() === "" ? null : Number(raw);
  const numeric = parsed !== null && Number.isFinite(parsed) ? parsed : null;
  const hasRange = min !== undefined && max !== undefined;
  const outOfRange =
    numeric !== null &&
    ((min !== undefined && numeric < min) || (max !== undefined && numeric > max));

  const handleChange = (text: string) => {
    setRaw(text);
    if (text.trim() === "") {
      emit(null);
      return;
    }
    const n = Number(text);
    // A partial entry ("-", "1e") is not a number yet. Holding the text and
    // emitting nothing is the only reading that is not a lie.
    if (Number.isFinite(n)) emit(n);
  };

  const handleBlur = () => {
    if (numeric === null) return;
    let clamped = numeric;
    if (min !== undefined && clamped < min) clamped = min;
    if (max !== undefined && clamped > max) clamped = max;
    if (clamped === numeric) return;
    setRaw(String(clamped));
    emit(clamped);
  };

  return (
    <Field label={label} htmlFor={inputId}>
      {description && (
        <p id={descriptionId} className="text-body text-ps-text-muted">{description}</p>
      )}
      <FieldInput
        id={inputId}
        aria-label={label}
        type="number"
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        min={min}
        max={max}
        aria-invalid={outOfRange ? "true" : undefined}
        aria-describedby={[description ? descriptionId : "", outOfRange || hasRange ? problemId : ""].filter(Boolean).join(" ") || undefined}
        className="font-mono"
      />
      {outOfRange ? (
        <p id={problemId} className="text-body text-neon-orange">
          {`${label} must be between ${min} and ${max} (got ${numeric})`}
        </p>
      ) : (
        hasRange && (
          <p id={problemId} className="text-body text-ps-text-faint">{`Range: ${min}–${max}`}</p>
        )
      )}
    </Field>
  );
}
