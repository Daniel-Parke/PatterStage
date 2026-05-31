// ═══════════════════════════════════════════════════════════════
// ConfigField — Renders a single config field by its schema type
// ═══════════════════════════════════════════════════════════════

"use client";

import { Toggle, Select, NumberInput, TextInput } from "@/components/ui/Input";
import type { FieldDef, SectionDef } from "@/lib/config-schema";

interface ConfigFieldProps {
  field: FieldDef;
  value: unknown;
  sectionDef: SectionDef;
  onUpdate: (key: string, value: unknown) => void;
}

export default function ConfigField({ field, value, sectionDef, onUpdate }: ConfigFieldProps) {
  switch (field.type) {
    case "boolean":
      return (
        <Toggle
          label={field.label}
          value={Boolean(value)}
          onChange={(v) => onUpdate(field.key, v)}
          description={field.description}
          color={sectionDef.color}
        />
      );
    case "number":
      return (
        <NumberInput
          label={field.label}
          value={typeof value === "number" ? value : 0}
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
          value={typeof value === "string" ? value : ""}
          onChange={(v) => onUpdate(field.key, v)}
          options={field.options || []}
          description={field.description}
          color={sectionDef.color}
        />
      );
    default:
      // Guard against rendering object/array values as "[object Object]"
      // which would silently corrupt the config.yaml on save.
      if (typeof value === "object" && value !== null) {
        return (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/70">
              {field.label}
            </label>
            {field.description && (
              <p className="text-xs text-white/40">{field.description}</p>
            )}
            <div className="text-xs text-white/30 bg-dark-800/50 rounded-lg p-3 font-mono max-h-60 overflow-y-auto whitespace-pre-wrap">
              {JSON.stringify(value, null, 2) || "(not configured)"}
            </div>
          </div>
        );
      }
      return (
        <TextInput
          label={field.label}
          value={typeof value === "string" ? value : String(value ?? "")}
          onChange={(v) => onUpdate(field.key, v)}
          description={field.description}
          placeholder={field.placeholder}
        />
      );
  }
}