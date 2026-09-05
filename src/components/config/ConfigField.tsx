// ═══════════════════════════════════════════════════════════════
// ConfigField — one config field, including the state of not being set
// ═══════════════════════════════════════════════════════════════
//
// Every field used to be coerced into a value: an absent boolean rendered as
// a switch in the off position, an absent number as 0, an absent string as "".
// So the page could not tell "Hermes uses its own default" from "the operator
// chose off", and saving the section wrote the coercion into config.yaml as
// though it were a decision (T-0100, D78). Unset is now a state with its own
// pill, its own sentence and no value, and any field that HAS a value carries
// a Clear that puts it back.
//
// A value the schema did not expect is shown rather than hidden (D77's UI
// half): a select holding something outside its options, or a toggle holding a
// string, says so beside the control instead of silently rendering as blank
// or as false.

"use client";

import { Toggle, Select, NumberInput, TextInput } from "@/components/ui/Input";
import type { FieldDef, SectionDef } from "@/lib/config-schema";

interface ConfigFieldProps {
  field: FieldDef;
  value: unknown;
  sectionDef: SectionDef;
  onUpdate: (key: string, value: unknown) => void;
}

/** `null` is what a Clear leaves behind; `undefined` is a key that was never written. */
function isUnset(value: unknown): boolean {
  return value === null || value === undefined;
}

/**
 * A value that is set but not of the declared type. Named so the operator can
 * see what is in the file; the control below renders neutrally rather than
 * pretending the value is something it can display.
 */
function typeNoteFor(field: FieldDef, value: unknown): string | null {
  if (isUnset(value)) return null;
  if (field.type === "boolean" && typeof value !== "boolean") {
    return `Current value '${String(value)}' is not a boolean`;
  }
  if (field.type === "number" && typeof value !== "number") {
    return `Current value '${String(value)}' is not a number`;
  }
  if (field.type === "select" && typeof value === "string") {
    const options = field.options ?? [];
    if (!options.includes(value)) {
      return `Current value '${value}' is not one of: ${options.join(", ")}`;
    }
  }
  return null;
}

export default function ConfigField({ field, value, sectionDef, onUpdate }: ConfigFieldProps) {
  // The object preview is a different shape entirely: read-only, no control to
  // clear, and the "unset" vocabulary would not mean anything on it.
  if (field.type === "textarea" || field.type === "string") {
    if (typeof value === "object" && value !== null) {
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ps-text-secondary">{field.label}</label>
          {field.description && (
            <p className="text-xs text-ps-text-muted">{field.description}</p>
          )}
          <div className="text-xs text-ps-text-muted bg-dark-800/50 rounded-lg p-3 font-mono max-h-60 overflow-y-auto whitespace-pre-wrap">
            {JSON.stringify(value, null, 2) || "(not configured)"}
          </div>
        </div>
      );
    }
  }

  const unset = isUnset(value);
  const typeNote = typeNoteFor(field, value);

  const control = (() => {
    switch (field.type) {
      case "boolean":
        return (
          <Toggle
            label={field.label}
            // `value === true`, not `Boolean(value)`: a field holding the
            // string "yes" is not a switch that is on, it is a field the
            // note above is about.
            value={value === true}
            onChange={(v) => onUpdate(field.key, v)}
            description={field.description}
            color={sectionDef.color}
          />
        );
      case "number":
        return (
          <NumberInput
            label={field.label}
            value={typeof value === "number" ? value : null}
            // The emptied box answers null, never 0: 0 is a number an
            // operator might mean, and writing it for "I cleared this" is
            // the coercion this replaces.
            onChange={(v) => onUpdate(field.key, v)}
            min={field.min}
            max={field.max}
            description={field.description}
          />
        );
      case "select":
        return (
          <Select
            label={field.label}
            // An out-of-options value shows the placeholder and is explained
            // by the note; the option list itself is never widened to include it.
            value={typeof value === "string" && (field.options ?? []).includes(value) ? value : ""}
            onChange={(v) => onUpdate(field.key, v)}
            options={field.options || []}
            description={field.description}
            color={sectionDef.color}
          />
        );
      default:
        return (
          <TextInput
            label={field.label}
            value={typeof value === "string" ? value : ""}
            onChange={(v) => onUpdate(field.key, v === "" ? null : v)}
            description={field.description}
            placeholder={unset ? "Not set" : field.placeholder}
          />
        );
    }
  })();

  return (
    <div className="space-y-1.5">
      {control}
      {/* Under the control, never above it: the state and the Clear belong to
          the field they follow, and a row of chrome above a block reads as the
          previous field's (found on the T-0100 proof walk). */}
      <div className="flex items-center justify-between gap-2">
        {unset ? (
          <p className="text-xs text-ps-text-faint">Hermes uses its own default</p>
        ) : (
          <span />
        )}
        {unset ? (
          <span className="text-xs font-mono text-ps-text-faint bg-white/5 px-1.5 py-0.5 rounded">
            Not set
          </span>
        ) : (
          <button
            type="button"
            aria-label={`Clear ${field.label}`}
            onClick={() => onUpdate(field.key, null)}
            className="text-xs font-mono text-ps-text-muted hover:text-white hover:bg-white/5 px-1.5 py-0.5 rounded transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      {typeNote && <p className="text-xs text-neon-orange">{typeNote}</p>}
    </div>
  );
}
