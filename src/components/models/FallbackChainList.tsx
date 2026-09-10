// ═══════════════════════════════════════════════════════════════
// FallbackChainList — ordered fallback chain management
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback, useState } from "react";
import { ChevronUp, ChevronDown, Plus, Edit3 } from "lucide-react";
import type { FallbackChainEntry } from "@/types/console";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import GlowSurface from "@/components/ui/GlowSurface";
import { Field, Input } from "@/components/ui/field";
import { InlineToggle } from "@/components/ui/Input";
import PerRowDeleteButton from "@/components/models/PerRowDeleteButton";

interface FallbackChainListProps {
  chain: FallbackChainEntry[];
  models: Array<{ id: string; name: string; provider: string; modelId: string }>;
  onReorder: (entryId: string, direction: "up" | "down") => void;
  onToggle: (entryId: string, enabled: boolean) => void;
  onDelete: (entryId: string) => void;
  onEdit: (entry: FallbackChainEntry) => void;
  onAddFromRegistry: (modelId: string) => void;
  onAddCustom: (modelId: string, provider: string, modelIdString: string, baseUrl?: string) => void;
  disabled?: boolean;
}

interface FallbackRowProps {
  entry: FallbackChainEntry;
  position: number;
  total: number;
  disabled: boolean;
  onReorder: (entryId: string, direction: "up" | "down") => void;
  onToggle: (entryId: string, enabled: boolean) => void;
  onDelete: (entryId: string) => void;
  onEdit: (entry: FallbackChainEntry) => void;
}

/**
 * One row in the fallback chain. The delete button's `useTwoStepConfirm`
 * lives inside `PerRowDeleteButton`, so each row owns its own armed state —
 * a stale arm on one row cannot fire on another.
 */
function FallbackRow({
  entry,
  position,
  total,
  disabled,
  onReorder,
  onToggle,
  onDelete,
  onEdit,
}: FallbackRowProps) {
  return (
    <tr
      key={entry.id}
      className="border-b border-ps-edge-hairline last:border-0 hover:bg-ps-surface-raised transition-colors"
    >
      <td className="px-3 py-2">
        <span className="inline-flex items-center justify-center w-5 h-5 text-micro font-mono bg-ps-surface-raised text-ps-text-muted rounded-ps-sm">
          {position + 1}
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="font-mono text-ps-text-primary truncate max-w-[200px]">
          {entry.modelName}
        </div>
        <div className="text-micro font-mono text-ps-text-muted truncate max-w-[200px]">
          {entry.provider} / {entry.modelIdString}
        </div>
      </td>
      <td className="px-3 py-2 text-center">
        <InlineToggle
          value={entry.enabled}
          onChange={(enabled) => onToggle(entry.id, enabled)}
          disabled={disabled}
          color="purple"
          label={`Enable ${entry.provider} / ${entry.modelIdString} in the fallback chain`}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          {/* Reorder buttons */}
          <button
            type="button"
            onClick={() => onReorder(entry.id, "up")}
            disabled={disabled || position === 0}
            title="Move up"
            className="p-1 rounded-ps-sm text-ps-text-muted hover:text-ps-text-primary hover:bg-ps-surface-raised transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onReorder(entry.id, "down")}
            disabled={disabled || position === total - 1}
            title="Move down"
            className="p-1 rounded-ps-sm text-ps-text-muted hover:text-ps-text-primary hover:bg-ps-surface-raised transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {/* Edit */}
          <button
            type="button"
            onClick={() => onEdit(entry)}
            disabled={disabled}
            title="Edit"
            className="p-1 rounded-ps-sm text-ps-text-muted hover:text-neon-purple hover:bg-neon-purple/10 transition-colors disabled:opacity-50"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          {/* Delete */}
          <PerRowDeleteButton
            rowId={entry.id}
            rowName={entry.modelName}
            onDelete={() => onDelete(entry.id)}
            disabled={disabled}
          />
        </div>
      </td>
    </tr>
  );
}

interface AddCustomFormProps {
  onConfirm: (modelId: string, provider: string, modelIdString: string, baseUrl?: string) => void;
  onCancel: () => void;
}

function AddCustomForm({ onConfirm, onCancel }: AddCustomFormProps) {
  const [modelId, setModelId] = useState("");
  const [provider, setProvider] = useState("");
  const [modelIdString, setModelIdString] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modelId && provider && modelIdString) {
      onConfirm(modelId, provider, modelIdString, baseUrl || undefined);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="p-3 bg-ps-surface-raised rounded-ps-md space-y-2"
    >
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name">
          <Input
            type="text"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="My Custom Model"
            aria-label="Model name"
            className="h-8 font-mono text-micro"
            required
          />
        </Field>
        <Field label="Provider">
          <Input
            type="text"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="openai"
            aria-label="Provider"
            className="h-8 font-mono text-micro"
            required
          />
        </Field>
      </div>
      <Field label="Model ID">
        <Input
          type="text"
          value={modelIdString}
          onChange={(e) => setModelIdString(e.target.value)}
          placeholder="gpt-4o"
          aria-label="Model ID"
          className="h-8 font-mono text-micro"
          required
        />
      </Field>
      <Field label="Base URL (optional)">
        <Input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
          aria-label="Base URL"
          className="h-8 font-mono text-micro"
        />
      </Field>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" color="purple" size="sm">
          Add
        </Button>
      </div>
    </form>
  );
}

export default function FallbackChainList({
  chain,
  models,
  onReorder,
  onToggle,
  onDelete,
  onEdit,
  onAddFromRegistry,
  onAddCustom,
  disabled = false,
}: FallbackChainListProps) {
  const [showRegistryDropdown, setShowRegistryDropdown] = useState(false);
  const [showAddCustom, setShowAddCustom] = useState(false);

  const closeAddCustom = useCallback(() => setShowAddCustom(false), []);

  const handleAddFromRegistry = (modelId: string) => {
    onAddFromRegistry(modelId);
    setShowRegistryDropdown(false);
  };

  const sortedChain = [...chain].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-2">
      {sortedChain.length === 0 && !showAddCustom ? (
        <Card glow="purple" padding="none" className="py-6 text-center font-mono text-micro text-ps-text-muted">
          No fallback models configured
        </Card>
      ) : (
        <GlowSurface accent="purple">
          <table className="w-full text-body">
            <thead>
              <tr className="text-left text-micro font-mono uppercase tracking-widest text-ps-text-muted border-b border-ps-edge-hairline">
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2 w-16 text-center">Enabled</th>
                <th className="px-3 py-2 w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedChain.map((entry, index) => (
                <FallbackRow
                  key={entry.id}
                  entry={entry}
                  position={index}
                  total={sortedChain.length}
                  disabled={disabled}
                  onReorder={onReorder}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onEdit={onEdit}
                />
              ))}
            </tbody>
          </table>
        </GlowSurface>
      )}

      {/* Add Custom inline form */}
      {showAddCustom && (
        <AddCustomForm
          onConfirm={(name, provider, modelIdString, baseUrl) => {
            void onAddCustom(name, provider, modelIdString, baseUrl);
            closeAddCustom();
          }}
          onCancel={closeAddCustom}
        />
      )}

      {/* Add buttons */}
      <div className="flex items-center gap-2 pt-1">
        {/* Add from Registry dropdown */}
        <div className="relative">
          <Button
            variant="secondary"
            icon={Plus}
            onClick={() => setShowRegistryDropdown((v) => !v)}
            disabled={disabled || models.length === 0}
          >
            Add from Registry
            <ChevronDown className="w-3 h-3" />
          </Button>
          {showRegistryDropdown && (
            <Card
              variant="raised"
              padding="none"
              className="absolute left-0 top-full z-dropdown mt-1 w-56 overflow-hidden shadow-xl"
            >
              {models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => void handleAddFromRegistry(m.id)}
                  className="w-full px-3 py-2 text-left hover:bg-ps-surface-raised transition-colors"
                >
                  <div className="text-micro font-mono text-ps-text-primary truncate">
                    {m.name}
                  </div>
                  <div className="text-micro font-mono text-ps-text-muted truncate">
                    {m.provider} / {m.modelId}
                  </div>
                </button>
              ))}
            </Card>
          )}
        </div>

        {/* Add Custom button */}
        <Button
          variant="secondary"
          icon={Plus}
          onClick={() => setShowAddCustom(true)}
          disabled={disabled}
        >
          Add Custom
        </Button>
      </div>
    </div>
  );
}
