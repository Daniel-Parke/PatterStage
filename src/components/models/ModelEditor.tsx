// ═══════════════════════════════════════════════════════════════
// ModelEditor — modal for create / edit of a registry model
// ═══════════════════════════════════════════════════════════════
//
// Backed by /api/models + /api/credentials. Edit mode never echoes
// the existing API key (API never returns it); leaving the inline
// API key input blank keeps whatever credential row is currently
// attached.

"use client";

import { useState, useMemo, type ReactNode } from "react";
import type { ModelRow } from "@/lib/models/model-types";
import {
  Plus,
  Edit3,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react";

import { Panel } from "@/components/dashboard/Panel";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import type { ToastType } from "@/components/ui/Toast";
import CredentialPicker, {
  type CredentialOption,
} from "@/components/models/CredentialPicker";
import { Input, Select } from "@/components/ui/field";
import { apiFetch } from "@/lib/api-fetch";
import { runWrite } from "@/lib/api-write";

/**
 * Minimal model shape for the editor form — a subset of ApiModel
 * that omits defaults, createdAt, updatedAt (not editable in the form).
 */
export type ModelEditorRecord = ModelRow;

interface ModelEditorProps {
  /** When null, the modal is in create mode. */
  model: ModelEditorRecord | null;
  credentials: CredentialOption[];
  /**
   * Provider ids for the dropdown, supplied by the page.
   *
   * Injected rather than imported: the models registry is core (llm.ts and the
   * mission body read it), but the LIST of providers is the agent framework's --
   * its own comment says it must stay in lock-step with the agent CLI's
   * `--provider` choices. The page is app/ and may consult the module; this
   * component may not.
   */
  providers: readonly string[];
  /**
   * The subset of `providers` that works without an API key, supplied by the
   * page for the same ADR-0005 reason as `providers` itself. Empty by default,
   * which is the behaviour every caller had before D15.
   */
  keylessProviders?: readonly string[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  provider: string;
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
    provider: model?.provider ?? "anthropic",
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
 * Validate the model-editor form before submission. Returns the user-facing
 * error for the first failing field, or `null`. Pure: the `credentialLabel`
 * auto-fill is a state side-effect and stays in the caller.
 */
function validateModelForm(
  form: FormState,
  isEdit: boolean,
  usingExisting: boolean,
  keyless = false,
): string | null {
  if (!form.name.trim()) return "Name is required";
  if (!form.modelId.trim()) return "Model ID is required";
  // A local Ollama has no key to demand. Requiring one made the operator
  // invent a string, which then got written into the agent's env file as
  // though it meant something (T-0100, D15).
  if (!isEdit && !usingExisting && !keyless && !form.apiKey.trim()) {
    return "API key is required when creating a new credential";
  }
  return null;
}

function parseOptionalStringField(
  raw: string,
  parse: (trimmed: string) => string | number,
): string | number | null {
  const trimmed = raw.trim();
  return trimmed === "" ? null : parse(trimmed);
}

/**
 * The labelled field shell this form repeats seven times: a label, the
 * control, and an optional caption under it. The label takes a node so a
 * call site can carry an inline "(optional)" marker; the control is passed
 * through as-is and owns its own chrome. It was a file of its own
 * (FieldRow.tsx) with one importer, which is this one (C6).
 */
function FieldRow({
  label,
  children,
  description,
}: {
  label: ReactNode;
  children: ReactNode;
  description?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-body font-medium text-ps-text-secondary">{label}</label>
      {children}
      {description && (
        <p className="text-micro text-ps-text-muted font-mono">{description}</p>
      )}
    </div>
  );
}

export default function ModelEditor({
  model,
  credentials,
  providers,
  keylessProviders = [],
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
  // Read off the injected list rather than imported: this component is core
  // and the provider vocabulary belongs to the agent framework (ADR-0005).
  const keyless = keylessProviders.includes(form.provider);

  // runWrite's words, said where this modal says things. A failure goes under
  // the title, as the alert the fields sit beneath. The success is not said
  // here: the page announces "Model saved" once the registry has reloaded
  // (useModelActions.handleSaved), and by then this modal has unmounted, so a
  // toast from here would say it twice.
  const sayInline = (message: string, type?: ToastType) => {
    if (type === "error") setError(message);
  };

  const handleSubmit = async () => {
    const validationError = validateModelForm(form, isEdit, usingExisting, keyless);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!usingExisting && !form.credentialLabel.trim() && !isEdit) {
      // Auto-generate a sensible default label
      update("credentialLabel", `${form.provider} key`);
    }

    setError(null);

    // One write as far as the operator is concerned, in two calls: the
    // credential first when a key was pasted, then the model that points at
    // it. A throw from either lands in the alert above the fields.
    await runWrite({
      showToast: sayInline,
      setBusy: setSaving,
      request: async () => {
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

        return isEdit && model
          ? apiFetch(`/api/models/${encodeURIComponent(model.id)}`, { method: "PUT", body: JSON.stringify(body) })
          : apiFetch("/api/models", { method: "POST", body: JSON.stringify(body) });
      },
      successMessage: "Model saved",
      errorMessage: "Save failed",
      onSuccess: onSaved,
    });
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
          <Panel
            role="alert"
            accent="red"
            tint="red"
            className="flex items-center gap-2 px-3 py-2 text-body text-semantic-danger"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </Panel>
        )}

        <FieldRow
          label="Name"
          description="Display name only — does not need to match the model identifier"
        >
          <Input
            type="text"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. Claude Sonnet 4 (production)"
          />
        </FieldRow>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldRow label="Provider">
            <Select
              ariaLabel="Provider"
              value={form.provider}
              onChange={(v) => {
                update("provider", v);
                update("credentialsId", null);
              }}
              options={providers.map((p) => ({ value: p, label: p }))}
            />
          </FieldRow>

          <FieldRow label="Model ID">
            <Input
              type="text"
              value={form.modelId}
              onChange={(e) => update("modelId", e.target.value)}
              placeholder="anthropic/claude-sonnet-4"
            />
          </FieldRow>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldRow
            label={
              <>
                Base URL
                <span className="ml-2 text-micro text-ps-text-muted font-mono">(optional)</span>
              </>
            }
          >
            <Input
              type="text"
              value={form.baseUrl}
              onChange={(e) => update("baseUrl", e.target.value)}
              placeholder="https://api.anthropic.com/v1"
            />
          </FieldRow>
          <FieldRow
            label={
              <>
                Context Length
                <span className="ml-2 text-micro text-ps-text-muted font-mono">(optional)</span>
              </>
            }
          >
            <Input
              type="number"
              value={form.contextLength}
              onChange={(e) => update("contextLength", e.target.value)}
              placeholder="200000"
              min={1000}
            />
          </FieldRow>
        </div>

        <CredentialPicker
          credentials={filteredCredentials}
          selected={form.credentialsId}
          onChange={(id) => update("credentialsId", id)}
          providerFilter={form.provider}
          keyless={keyless}
        />

        {!usingExisting && (
          <Panel accent="purple" tint="purple" className="space-y-3 p-3">
            <p className="text-micro font-mono text-neon-purple uppercase tracking-widest">
              {keyless ? "Credential (optional)" : "New credential"}
            </p>
            {keyless && (
              <p className="text-body text-ps-text-muted">
                {`${form.provider} needs no API key. Leave this blank, or paste one if your endpoint requires it.`}
              </p>
            )}
            <FieldRow label="Credential Label">
              <Input
                type="text"
                value={form.credentialLabel}
                onChange={(e) => update("credentialLabel", e.target.value)}
                placeholder={`${form.provider} key`}
              />
            </FieldRow>
            <FieldRow
              label="API Key"
              // design-lint-disable-next-line hermes-outside-adapter -- a credential warning. It tells the operator, before they paste a key, exactly which file on disk that key will end up in readable form in. That disclosure is the field's reason for existing.
              description="Stored plain text in the registry and synced to ~/.hermes/.env so Hermes can read it."
            >
              <Input
                type="password"
                autoComplete="off"
                value={form.apiKey}
                onChange={(e) => update("apiKey", e.target.value)}
                placeholder={
                  keyless
                    ? "Leave blank, none needed"
                    : isEdit
                      ? "Leave blank to keep existing"
                      : "sk-..."
                }
              />
            </FieldRow>
          </Panel>
        )}
      </div>
    </Modal>
  );
}
