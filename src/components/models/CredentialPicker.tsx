// ═══════════════════════════════════════════════════════════════
// CredentialPicker — choose an existing credential or "Create new"
// ═══════════════════════════════════════════════════════════════
//
// Used inside ModelEditor to attach a stored credential row to a
// model. Filtering by provider keeps the dropdown sensible.
//
// Two-mode interaction:
//   - "use existing"  → emit credentialsId, hide API key input
//   - "create new"    → caller renders an inline API key input and
//                        creates the credential before saving the model
//
// API key is NEVER edited or echoed here.

"use client";

import { Select } from "@/components/ui/field";

export interface CredentialOption {
  id: string;
  label: string;
  provider: string;
  keyHint: string;
}

interface CredentialPickerProps {
  credentials: CredentialOption[];
  selected: string | null;
  /** When `null`, the caller is adding a new credential. */
  onChange: (credentialId: string | null) => void;
  /** Restrict listing to a single provider (model.provider). */
  providerFilter?: string;
  /** True when the chosen provider needs no API key, so "none" is a real answer. */
  keyless?: boolean;
  disabled?: boolean;
}

const NEW_CREDENTIAL = "__new__";

export default function CredentialPicker({
  credentials,
  selected,
  onChange,
  providerFilter,
  keyless = false,
  disabled = false,
}: CredentialPickerProps) {
  const filtered = providerFilter
    ? credentials.filter((c) => c.provider === providerFilter)
    : credentials;

  const value = selected ?? NEW_CREDENTIAL;

  return (
    <div className="space-y-1.5">
      <span className="block text-body font-medium text-ps-text-secondary">Credential</span>
      <Select
        ariaLabel="Credential"
        value={value}
        onChange={(v) => onChange(v === NEW_CREDENTIAL ? null : v)}
        disabled={disabled}
        options={[
          {
            value: NEW_CREDENTIAL,
            // The same slot, said honestly: for a keyless provider leaving it
            // here is a finished choice, not a step the operator has skipped.
            label: keyless ? "No credential (none needed)" : "+ Create new credential",
          },
          ...filtered.map((c) => ({ value: c.id, label: c.label, hint: c.keyHint || "no hint" })),
        ]}
      />
      <p className="text-micro text-ps-text-muted font-mono">
        {selected
          ? "Reusing an existing credential row from the registry."
          : keyless
            ? "No key is needed for this provider. Pick a credential only if your endpoint requires one."
            : "A new credential will be created and stored alongside this model."}
      </p>
    </div>
  );
}

CredentialPicker.NEW_CREDENTIAL = NEW_CREDENTIAL;
