// ═══════════════════════════════════════════════════════════════
// ModelSelectDropdown — model <select> with shared chrome
// ═══════════════════════════════════════════════════════════════
//
// Shared by `DefaultsGrid` (per-slot task defaults) and
// `BulkAuxiliaryUpdater` (target model picker). Both call sites
// had an identical 19-line pattern pre-refactor:
//
//   <div className="relative">
//     <select
//       value={...}
//       onChange={...}
//       disabled={...}
//       className="w-full h-9 min-h-9 bg-dark-XXX border border-white/10
//                  rounded-lg px-3 pr-8 text-sm text-white
//                  font-mono outline-none cursor-pointer
//                  transition-colors hover:border-white/20
//                  focus:border-neon-purple/50 disabled:opacity-50
//                  truncate appearance-none"
//     >
//       <option value="">— placeholder —</option>
//       {models.map((m) => (
//         <option key={m.id} value={m.id}>
//           {m.name} ({m.provider}/{m.modelId})
//         </option>
//       ))}
//     </select>
//     <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2
//                             w-4 h-4 text-ps-text-muted pointer-events-none" />
//   </div>
//
// The two sites were identical except for (a) the placeholder text
// ("— none —" vs "— Select model —"), (b) the focus accent colour
// (purple), and (c) the model label format (always `${name}
// (${provider}/${modelId})` — verified identical between the two
// sites). Extracting keeps the select chrome + chevron positioning
// in lockstep — a future "increase row height" or "add a clear
// button" tweak is a one-file change.
//
// NOT a candidate: the agent-default `<select>` in
// `ModelsAgentDefaultSection.tsx` is a different shape (no chevron
// overlay, no `relative` wrapper, different focus colour
// `neon-orange`, different model label format `${m.name}` only).
// That site stays inline — a forced extraction would either add a
// chevron (visible behavior change) or accept a 5-prop API surface
// with 2 of the 5 props no-op, which is a worse outcome than the
// current "two distinct call sites".

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
