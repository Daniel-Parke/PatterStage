// ═══════════════════════════════════════════════════════════════
// ModelEditor — modal for create / edit of a registry model
// ═══════════════════════════════════════════════════════════════
//
// Backed by /api/models + /api/credentials. Edit mode never echoes
// the existing API key (API never returns it); leaving the inline
// API key input blank keeps whatever credential row is currently
// attached.

"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  Edit3,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { HERMES_PROVIDERS, type HermesProvider } from "@/lib/hermes-providers";
import CredentialPicker, {
  type CredentialOption,
} from "@/components/models/CredentialPicker";
import FieldRow from "@/components/models/FieldRow";
import { inputFieldClasses } from "@/lib/theme";
import { apiFetch, setErrorFromCaught } from "@/lib/api-fetch";

/**
 * Minimal model shape for the editor form — a subset of ApiModel
 * that omits defaults, createdAt, updatedAt (not editable in the form).
 */
export interface ModelEditorRecord {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  baseUrl: string | null;
  contextLength: number | null;
  credentialsId: string | null;
}

interface ModelEditorProps {
  /** When null, the modal is in create mode. */
  model: ModelEditorRecord | null;
  credentials: CredentialOption[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  provider: HermesProvider;
  modelId: string;
  baseUrl: string;
  contextLength: string;
  credentialsId: string | null;
  apiKey: string;
  credentialLabel: string;
}

function initialFormState(model: ModelEditorRecord | null): FormState {
  return {
    name: model?.name ?? "",
    provider: ((model?.provider as HermesProvider) ?? "anthropic"),
    modelId: model?.modelId ?? "",
    baseUrl: model?.baseUrl ?? "",
    contextLength:
      model?.contextLength != null ? String(model.contextLength) : "",
    credentialsId: model?.credentialsId ?? null,
    apiKey: "",
    credentialLabel: "",
  };
}

/**
 * Validate the model-editor form before submission. Pure function
 * (no side effects) — returns the user-facing error string for the
 * first failing field, or `null` if all fields are valid. Centralises
 * the 4 sequential `if (!X) return setError(Y)` checks that previously
 * inlined the validation logic into `handleSubmit`, so the caller can
 * early-return on a single guard instead of repeating the `setError +
 * return` shape. The auto-fill of `credentialLabel` (a state
 * side-effect) is intentionally NOT done here — it lives in the caller
 * after the validation passes, so the helper stays pure and the state
 * mutation is visible in the same scope as the submit flow.
 */
function validateModelForm(
  form: FormState,
  isEdit: boolean,
  usingExisting: boolean,
): string | null {
  if (!form.name.trim()) return "Name is required";
  if (!form.modelId.trim()) return "Model ID is required";
  if (!isEdit && !usingExisting && !form.apiKey.trim()) {
    return "API key is required when creating a new credential";
  }
  return null;
}

/**
 * Parse an optional string-form numeric field. Centralises the
 * `trim() === "" ? null : <trim()>` pattern that was duplicated for
 * `baseUrl` (raw string) and `contextLength` (Number-coerced). Returns
 * the parsed value or `null` for blank input. The `parse` parameter
 * lets the caller control the value transformation (raw string for
 * baseUrl, Number() for contextLength).
 */
function parseOptionalStringField(
  raw: string,
  parse: (trimmed: string) => string | number,
): string | number | null {
  const trimmed = raw.trim();
  return trimmed === "" ? null : parse(trimmed);
}

export default function ModelEditor({
  model,
  credentials,
  onClose,
  onSaved,
}: ModelEditorProps) {
  const isEdit = model !== null;
  const [form, setForm] = useState<FormState>(() => initialFormState(model));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const filteredCredentials = useMemo(
    () => credentials.filter((c) => c.provider === form.provider),
    [credentials, form.provider]
  );

  const usingExisting = form.credentialsId !== null;

  const handleSubmit = async () => {
    // Field-level validation — single guard against the pure helper
    // (returns the first failing field's error message, or `null`).
    // Pre-refactor: 4 sequential `if (!X) return setError(Y)` checks
    // each combined validation + side-effect into 1 line; the
    // credentialLabel auto-fill (a state mutation) was entangled
    // with the validation flow, making the order of side-effects
    // implicit. Post-refactor: validation is a pure function call,
    // and the credentialLabel auto-fill (still a state mutation)
    // lives between the validation guard and the saving state
    // transition so its position in the flow is explicit.
    const validationError = validateModelForm(form, isEdit, usingExisting);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!usingExisting && !form.credentialLabel.trim() && !isEdit) {
      // Auto-generate a sensible default label
      update("credentialLabel", `${form.provider} key`);
    }

    setSaving(true);
    setError(null);

    try {
      let credentialsId = form.credentialsId;

      if (!usingExisting && form.apiKey.trim().length > 0) {
        const label =
          form.credentialLabel.trim() || `${form.provider} key`;
        const result = await apiFetch<{ data?: { credential?: { id: string } } }>("/api/credentials", {
          method: "POST",
          body: JSON.stringify({
            label,
            provider: form.provider,
            apiKey: form.apiKey.trim(),
          }),
        });
        const newId = result.data?.credential?.id;
        if (!newId) throw new Error("Credential creation returned no id");
        credentialsId = newId;
      }

      const baseUrl = parseOptionalStringField(form.baseUrl, (t) => t) as string | null;
      const contextLength = parseOptionalStringField(
        form.contextLength,
        Number,
      ) as number | null;

      if (
        contextLength !== null &&
        (!Number.isFinite(contextLength) || contextLength <= 0)
      ) {
        throw new Error("Context length must be a positive number");
      }

      const body: Record<string, unknown> = {
        name: form.name.trim(),
        provider: form.provider,
        modelId: form.modelId.trim(),
        baseUrl,
        contextLength,
        credentialsId,
      };

      if (isEdit && model) {
        await apiFetch(`/api/models/${encodeURIComponent(model.id)}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/api/models", { method: "POST", body: JSON.stringify(body) });
      }

      onSaved();
    } catch (err) {
      setErrorFromCaught(setError, err, "Save failed");
    } finally {
      // Always clear the saving state, regardless of success or failure.
      // The success path unmounts the modal via `onSaved()` → parent
      // `setEditing(undefined)`, so this is currently invisible — but if
      // the parent ever defers the unmount, OR if the modal is reused
      // for a 2nd edit without remount, the saving spinner would stay
      // stuck on the success path. The 3 lines are the same shape as
      // `toggleSkill`'s `finally` block (skills page) and the
      // `runFallbackMutation` pattern (useModelsPage) — one canonical
      // place to reset the busy flag, not duplicated in success/failure
      // branches. Was previously only in the catch block; the success
      // path relied on the parent unmounting the modal.
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit Model: ${model.name}` : "New Model"}
      icon={isEdit ? Edit3 : Plus}
      iconColor="text-neon-purple"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            color="purple"
            onClick={handleSubmit}
            loading={saving}
            icon={saving ? Loader2 : Check}
          >
            {isEdit ? "Save Changes" : "Create Model"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <FieldRow
          label="Name"
          description="Display name only — does not need to match the model identifier"
        >
          <input
            type="text"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. Claude Sonnet 4 (production)"
            className={inputFieldClasses("purple")}
          />
        </FieldRow>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldRow label="Provider">
            <select
              value={form.provider}
              onChange={(e) => {
                update("provider", e.target.value as HermesProvider);
                update("credentialsId", null);
              }}
              className={`${inputFieldClasses("purple")} appearance-none cursor-pointer`}
            >
              {HERMES_PROVIDERS.map((p) => (
                <option key={p} value={p} className="bg-dark-900">
                  {p}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Model ID">
            <input
              type="text"
              value={form.modelId}
              onChange={(e) => update("modelId", e.target.value)}
              placeholder="anthropic/claude-sonnet-4"
              className={inputFieldClasses("purple")}
            />
          </FieldRow>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldRow
            label={
              <>
                Base URL
                <span className="ml-2 text-xs text-white/30 font-mono">(optional)</span>
              </>
            }
          >
            <input
              type="text"
              value={form.baseUrl}
              onChange={(e) => update("baseUrl", e.target.value)}
              placeholder="https://api.anthropic.com/v1"
              className={inputFieldClasses("purple")}
            />
          </FieldRow>
          <FieldRow
            label={
              <>
                Context Length
                <span className="ml-2 text-xs text-white/30 font-mono">(optional)</span>
              </>
            }
          >
            <input
              type="number"
              value={form.contextLength}
              onChange={(e) => update("contextLength", e.target.value)}
              placeholder="200000"
              min={1000}
              className={inputFieldClasses("purple")}
            />
          </FieldRow>
        </div>

        <CredentialPicker
          credentials={filteredCredentials}
          selected={form.credentialsId}
          onChange={(id) => update("credentialsId", id)}
          providerFilter={form.provider}
        />

        {!usingExisting && (
          <div className="space-y-3 rounded-lg border border-neon-purple/15 bg-neon-purple/5 p-3">
            <p className="text-xs font-mono text-neon-purple/70 uppercase tracking-widest">
              New credential
            </p>
            <FieldRow label="Credential Label">
              <input
                type="text"
                value={form.credentialLabel}
                onChange={(e) => update("credentialLabel", e.target.value)}
                placeholder={`${form.provider} key`}
                className={inputFieldClasses("purple")}
              />
            </FieldRow>
            <FieldRow
              label="API Key"
              description="Stored plain text in the registry and synced to ~/.hermes/.env so Hermes can read it."
            >
              <input
                type="password"
                autoComplete="off"
                value={form.apiKey}
                onChange={(e) => update("apiKey", e.target.value)}
                placeholder={isEdit ? "Leave blank to keep existing" : "sk-..."}
                className={inputFieldClasses("purple")}
              />
            </FieldRow>
          </div>
        )}
      </div>
    </Modal>
  );
}
