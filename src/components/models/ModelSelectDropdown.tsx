// ═══════════════════════════════════════════════════════════════
// ModelSelectDropdown — model <select> with shared chrome
// ═══════════════════════════════════════════════════════════════
//
// Shared by `DefaultsGrid` (per-slot task defaults) and
// `BulkAuxiliaryUpdater` (target model picker).

"use client";

import { Select } from "@/components/ui/field";

interface ModelSelectOption {
  id: string;
  name: string;
  provider: string;
  modelId: string;
}

interface ModelSelectDropdownProps {
  options: ModelSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  /** Optional `aria-label` for the select element. */
  ariaLabel?: string;
  /** Optional `title` for hover tooltip. */
  title?: string;
  /** Retained for call-site compatibility; the Field Kit Select owns the
   *  consistent on-brand styling now (tone is no longer applied). */
  tone?: "panel" | "card";
}

/**
 * The shared model picker. Routes through the unified Field Kit `Select` so all
 * model dropdowns (per-slot defaults, bulk updater, fallbacks) get one
 * consistent, keyboard-accessible, on-brand dropdown instead of the OS-native
 * control. A leading empty option preserves the "— none —" choice.
 */
export default function ModelSelectDropdown({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  ariaLabel,
  title,
}: ModelSelectDropdownProps) {
  return (
    <div title={title}>
      <Select
        ariaLabel={ariaLabel ?? placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        options={[
          { value: "", label: placeholder },
          ...options.map((m) => ({ value: m.id, label: m.name, hint: `${m.provider}/${m.modelId}` })),
        ]}
      />
    </div>
  );
}
