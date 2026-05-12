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
  ChevronDown,
} from "lucide-react";

import { listFrameworks, UNIVERSAL_FRAMEWORK_ID, UNIVERSAL_FRAMEWORK_LABEL, type FrameworkEntry } from "@/lib/framework-registry";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { HERMES_PROVIDERS, type HermesProvider } from "@/lib/hermes-providers";
import CredentialPicker, {
  type CredentialOption,
} from "@/components/models/CredentialPicker";

export interface ModelEditorRecord {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  baseUrl: string | null;
  contextLength: number | null;
  credentialsId: string | null;
  frameworkId?: string;
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
  frameworkId: string;
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
    frameworkId: model?.frameworkId ?? UNIVERSAL_FRAMEWORK_ID,
    apiKey: "",
    credentialLabel: "",
  };
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `POST ${url} failed (${res.status})`);
  }
  return res.json();
}

async function putJson(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `PUT ${url} failed (${res.status})`);
  }
  return res.json();
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
    if (!form.name.trim()) return setError("Name is required");
    if (!form.modelId.trim()) return setError("Model ID is required");
    if (!isEdit && !usingExisting && !form.apiKey.trim()) {
      return setError("API key is required when creating a new credential");
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
        const result = (await postJson("/api/credentials", {
          label,
          provider: form.provider,
          apiKey: form.apiKey.trim(),
        })) as { data?: { credential?: { id: string } } };
        const newId = result.data?.credential?.id;
        if (!newId) throw new Error("Credential creation returned no id");
        credentialsId = newId;
      }

      const baseUrl = form.baseUrl.trim() === "" ? null : form.baseUrl.trim();
      const contextLength =
        form.contextLength.trim() === ""
          ? null
          : Number(form.contextLength);

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
        frameworkId: form.frameworkId,
      };

      if (isEdit && model) {
        await putJson(`/api/models/${encodeURIComponent(model.id)}`, body);
      } else {
        await postJson("/api/models", body);
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
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

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/70">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. Claude Sonnet 4 (production)"
            className="w-full bg-dark-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neon-purple/50 transition-colors font-mono"
          />
          <p className="text-xs text-white/30 font-mono">
            Display name only — does not need to match the model identifier
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/70">Provider</label>
            <select
              value={form.provider}
              onChange={(e) => {
                update("provider", e.target.value as HermesProvider);
                update("credentialsId", null);
              }}
              className="w-full bg-dark-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors font-mono appearance-none cursor-pointer focus:border-neon-purple/50"
            >
              {HERMES_PROVIDERS.map((p) => (
                <option key={p} value={p} className="bg-dark-900">
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/70">Model ID</label>
            <input
              type="text"
              value={form.modelId}
              onChange={(e) => update("modelId", e.target.value)}
              placeholder="anthropic/claude-sonnet-4"
              className="w-full bg-dark-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neon-purple/50 transition-colors font-mono"
            />
          </div>
        </div>

        {/* Framework Scope Selector */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/70">
            Framework Scope
            <span className="ml-2 text-xs text-white/30 font-mono">(which agent framework this model belongs to)</span>
          </label>
          <div className="relative">
            <select
              value={form.frameworkId}
              onChange={(e) => update("frameworkId", e.target.value)}
              className="w-full bg-dark-900/50 border border-white/10 rounded-lg px-3 py-2 pr-8 text-sm text-white outline-none transition-colors font-mono appearance-none cursor-pointer focus:border-neon-purple/50"
            >
              <option value={UNIVERSAL_FRAMEWORK_ID} className="bg-dark-900">
                {UNIVERSAL_FRAMEWORK_LABEL} (*) — available to all frameworks
              </option>
              {listFrameworks().map((fw: FrameworkEntry) => (
                <option key={fw.id} value={fw.id} className="bg-dark-900">
                  {fw.label} — {fw.description}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          </div>
          <p className="text-xs text-white/30 font-mono">
            Universal models can be used by any agent framework. Framework-specific models are only visible when that framework is selected.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/70">
              Base URL
              <span className="ml-2 text-xs text-white/30 font-mono">(optional)</span>
            </label>
            <input
              type="text"
              value={form.baseUrl}
              onChange={(e) => update("baseUrl", e.target.value)}
              placeholder="https://api.anthropic.com/v1"
              className="w-full bg-dark-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neon-purple/50 transition-colors font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/70">
              Context Length
              <span className="ml-2 text-xs text-white/30 font-mono">(optional)</span>
            </label>
            <input
              type="number"
              value={form.contextLength}
              onChange={(e) => update("contextLength", e.target.value)}
              placeholder="200000"
              min={1000}
              className="w-full bg-dark-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neon-purple/50 transition-colors font-mono"
            />
          </div>
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
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/70">
                Credential Label
              </label>
              <input
                type="text"
                value={form.credentialLabel}
                onChange={(e) => update("credentialLabel", e.target.value)}
                placeholder={`${form.provider} key`}
                className="w-full bg-dark-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neon-purple/50 transition-colors font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/70">API Key</label>
              <input
                type="password"
                autoComplete="off"
                value={form.apiKey}
                onChange={(e) => update("apiKey", e.target.value)}
                placeholder={isEdit ? "Leave blank to keep existing" : "sk-..."}
                className="w-full bg-dark-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neon-purple/50 transition-colors font-mono"
              />
              <p className="text-xs text-white/30 font-mono">
                Stored plain text in the registry and synced to ~/.hermes/.env so
                Hermes can read it.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
