// ═══════════════════════════════════════════════════════════════
// FallbackChainList — ordered fallback chain management
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback, useState } from "react";
import { ChevronUp, ChevronDown, Plus, Edit3 } from "lucide-react";
import type { FallbackChainEntry } from "@/types/console";
import GlowSurface from "@/components/ui/GlowSurface";
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
 * One row in the fallback chain. The delete button is delegated to
 * `PerRowDeleteButton` (a shared, per-row arm-confirm component that
 * also serves `ModelRow` in `ModelsTableSection`) so the armed-state
 * styling + aria-label shape stays in lockstep across the two
 * list-style tables. The per-row `useTwoStepConfirm` instance lives
 * inside the button, so each row owns its own armed state — a stale
 * arm on one row cannot fire on another.
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
      className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
    >
      <td className="px-3 py-2">
        <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-mono bg-white/10 text-ps-text-muted rounded">
          {position + 1}
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="font-mono text-white truncate max-w-[200px]">
          {entry.modelName}
        </div>
        <div className="text-xs font-mono text-ps-text-muted truncate max-w-[200px]">
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
            className="p-1 rounded text-ps-text-muted hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onReorder(entry.id, "down")}
            disabled={disabled || position === total - 1}
            title="Move down"
            className="p-1 rounded text-ps-text-muted hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {/* Edit */}
          <button
            type="button"
            onClick={() => onEdit(entry)}
            disabled={disabled}
            title="Edit"
            className="p-1 rounded text-ps-text-muted hover:text-neon-purple hover:bg-neon-purple/10 transition-colors disabled:opacity-50"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          {/* Delete — armed state mirrors the per-row delete pattern
              in ModelsTableSection (now shared via PerRowDeleteButton) */}
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
      className="p-3 bg-white/5 rounded-lg space-y-2"
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-mono text-ps-text-muted uppercase mb-0.5">
            Name
          </label>
          <input
            type="text"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="My Custom Model" aria-label="Model name"
            className="w-full h-8 bg-dark-800 border border-white/10 rounded px-2 text-xs text-white font-mono outline-none focus:border-neon-purple/50"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-ps-text-muted uppercase mb-0.5">
            Provider
          </label>
          <input
            type="text"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="openai" aria-label="Provider"
            className="w-full h-8 bg-dark-800 border border-white/10 rounded px-2 text-xs text-white font-mono outline-none focus:border-neon-purple/50"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-mono text-ps-text-muted uppercase mb-0.5">
          Model ID
        </label>
        <input
          type="text"
          value={modelIdString}
          onChange={(e) => setModelIdString(e.target.value)}
          placeholder="gpt-4o" aria-label="Model ID"
          className="w-full h-8 bg-dark-800 border border-white/10 rounded px-2 text-xs text-white font-mono outline-none focus:border-neon-purple/50"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-mono text-ps-text-muted uppercase mb-0.5">
          Base URL (optional)
        </label>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1" aria-label="Base URL"
          className="w-full h-8 bg-dark-800 border border-white/10 rounded px-2 text-xs text-white font-mono outline-none focus:border-neon-purple/50"
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 text-xs font-mono text-ps-text-muted hover:text-white rounded-lg hover:bg-white/5 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-3 py-1 text-xs font-mono bg-neon-purple/20 text-neon-purple rounded-lg hover:bg-neon-purple/30 transition-colors"
        >
          Add
        </button>
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

  // closeAddCustom — single-setter close-callback for the inline
  // AddCustomForm. Sister to the close-callbacks extracted in
  // /config/models/page.tsx + ModelSyncButtons.tsx (session 196) —
  // same useState-setter stability rationale. The 2 call sites
  // today are the Cancel button onClick and the post-onConfirm
  // `setShowAddCustom(false)` bare statement. Extracting keeps
  // them in lockstep if a future "reset the form fields on close"
  // or "fire an analytics event" extension lands. The
  // `setShowRegistryDropdown((v) => !v)` toggle is a different
  // shape (toggle, not close) and stays inline.
  const closeAddCustom = useCallback(() => setShowAddCustom(false), []);

  const handleAddFromRegistry = (modelId: string) => {
    onAddFromRegistry(modelId);
    setShowRegistryDropdown(false);
  };

  const sortedChain = [...chain].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-2">
      {sortedChain.length === 0 && !showAddCustom ? (
        <GlowSurface accent="purple">
          <div className="text-center py-6 rounded-xl border border-white/10 bg-dark-900/50 text-xs text-ps-text-muted font-mono">
            No fallback models configured
          </div>
        </GlowSurface>
      ) : (
        <GlowSurface accent="purple">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-mono uppercase tracking-widest text-ps-text-muted border-b border-white/5">
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
          <button
            type="button"
            onClick={() => setShowRegistryDropdown((v) => !v)}
            disabled={disabled || models.length === 0}
            className="flex items-center gap-1.5 px-3 h-8 text-xs font-mono text-ps-text-muted hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            Add from Registry
            <ChevronDown className="w-3 h-3" />
          </button>
          {showRegistryDropdown && (
            <div className="absolute top-full left-0 mt-1 z-10 w-56 bg-dark-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
              {models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => void handleAddFromRegistry(m.id)}
                  className="w-full px-3 py-2 text-left hover:bg-white/5 transition-colors"
                >
                  <div className="text-xs font-mono text-white truncate">
                    {m.name}
                  </div>
                  <div className="text-xs font-mono text-ps-text-muted truncate">
                    {m.provider} / {m.modelId}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add Custom button */}
        <button
          type="button"
          onClick={() => setShowAddCustom(true)}
          disabled={disabled}
          className="flex items-center gap-1.5 px-3 h-8 text-xs font-mono text-ps-text-muted hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Custom
        </button>
      </div>
    </div>
  );
}
