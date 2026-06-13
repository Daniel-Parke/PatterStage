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
//                             w-4 h-4 text-white/30 pointer-events-none" />
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

import { ChevronDown } from "lucide-react";

export interface ModelSelectOption {
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
  /** Background tone variant — `dark-800` (the default) matches the
   *  "panel" tone used by FallbackConfigPanel + BulkAuxiliaryUpdater;
   *  `dark-900/50` matches the per-slot card tone used by
   *  DefaultsGrid. Default is "panel". */
  tone?: "panel" | "card";
}

const TONE_CLASSES: Record<NonNullable<ModelSelectDropdownProps["tone"]>, string> = {
  panel: "bg-dark-800",
  card: "bg-dark-900/50",
};

export default function ModelSelectDropdown({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  ariaLabel,
  title,
  tone = "panel",
}: ModelSelectDropdownProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        title={title}
        className={`w-full h-9 min-h-9 ${TONE_CLASSES[tone]} border border-white/10 rounded-lg px-3 pr-8 text-sm text-white font-mono outline-none cursor-pointer transition-colors hover:border-white/20 focus:border-neon-purple/50 disabled:opacity-50 truncate appearance-none`}
      >
        <option value="">{placeholder}</option>
        {options.map((m) => (
          <option key={m.id} value={m.id} className="bg-dark-900">
            {m.name} ({m.provider}/{m.modelId})
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
    </div>
  );
}
